import { Fragment, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import {
  ArrowUpDown,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronRight,
  FolderDot,
  FolderOpenDot,
  Loader2,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Search,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@wizard-archive/ui/shadcn/components/dropdown-menu'
import { DOMAIN_ID_KIND, assertDomainId } from '../domain-id'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  ResourceKnowledge,
  WorkspaceResourceIndexSnapshot,
} from '../resource-index-contract'
import { RESOURCE_KIND } from '../resource-record'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import type { WorkspaceSort } from '../workspace-preferences'
import { updateWorkspaceSelection, workspaceSelectionIntent } from '../workspace-selection'
import type { WorkspaceSelection, WorkspaceSelectionAction } from '../workspace-selection'
import {
  allowWorkspaceResourceDrop,
  finishWorkspaceResourceDrop,
  leaveWorkspaceResourceDrop,
  workspaceResourceDropTargetProps,
  workspaceResourceInteractionProps,
} from '../workspace-resource-drag'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import { ResourceAppearancePopover } from './resource-appearance-popover'
import { resourceDisplayIcon } from './resource-icon'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { resourceContextMenuRequest } from './resource-context-menu-request'
import { useEnsureResourceCollection } from './resource-loading'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'
import { ResourceRenameInput } from './resource-rename-input'
import { ResourceTrashControl } from './resource-trash-control'
import { useWorkspaceCreation } from './use-workspace-creation'
import { WorkspaceCreationStatus } from './workspace-creation-status'

const EMPTY_BOOKMARKS: ReadonlySet<ResourceId> = new Set()

type ResourceTreeExpansion =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'available'; expanded: boolean; onChange: (expanded: boolean) => void }>

type ResourceTreeExpansionState = Readonly<{
  defaultExpanded: boolean
  exceptions: ReadonlySet<ResourceId>
}>

const DEFAULT_TREE_EXPANSION: ResourceTreeExpansionState = {
  defaultExpanded: false,
  exceptions: new Set(),
}

type ResourceTreeExpansionController = Readonly<{
  isExpanded: (resourceId: ResourceId) => boolean
  setExpanded: (resourceId: ResourceId, expanded: boolean) => void
}>

function isTreeResourceExpanded(
  state: ResourceTreeExpansionState,
  resourceId: ResourceId,
): boolean {
  return state.exceptions.has(resourceId) ? !state.defaultExpanded : state.defaultExpanded
}

function setTreeResourceExpanded(
  state: ResourceTreeExpansionState,
  resourceId: ResourceId,
  expanded: boolean,
): ResourceTreeExpansionState {
  if (isTreeResourceExpanded(state, resourceId) === expanded) return state
  const exceptions = new Set(state.exceptions)
  if (exceptions.has(resourceId)) exceptions.delete(resourceId)
  else exceptions.add(resourceId)
  return { ...state, exceptions }
}

function visibleAncestorIds(
  snapshot: WorkspaceResourceIndexSnapshot,
  resourceId: ResourceId,
): ReadonlyArray<ResourceId> {
  const ancestors = snapshot.ancestors(resourceId)
  return ancestors.state === 'known' ? ancestors.value.map((resource) => resource.id) : []
}

function parseWorkspaceSort(value: string): WorkspaceSort | null {
  const [by, direction] = value.split(':')
  if (
    (by === 'created' || by === 'title' || by === 'updated') &&
    (direction === 'ascending' || direction === 'descending')
  ) {
    return { by, direction }
  }
  return null
}

export function ResourceSidebar({
  actions,
  bookmarks,
  canEdit,
  onClose,
  onOpenBackgroundContextMenu,
  onOpenContextMenu,
  onRenamingResourceIdChange,
  onSearch,
  onSelectionChange,
  onSortChange,
  runtime,
  renamingResourceId,
  selectedResourceId,
  selection,
  slots,
  snapshot,
  sort,
  view,
  workspaceName,
  onViewChange,
}: {
  actions: WorkspaceActions
  bookmarks: ResourceKnowledge<ReadonlySet<ResourceId>>
  canEdit: boolean
  onClose: () => void
  onOpenBackgroundContextMenu: (position: Readonly<{ x: number; y: number }>) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onRenamingResourceIdChange: (resourceId: ResourceId | null) => void
  onSearch: () => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onSortChange: (sort: WorkspaceSort) => void
  runtime: EditorRuntime
  renamingResourceId: ResourceId | null
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  slots?: Readonly<{ footer?: ReactNode; headerEnd?: ReactNode; headerStart?: ReactNode }>
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  view: 'bookmarks' | 'resources'
  workspaceName: string | null
  onViewChange: (view: 'bookmarks' | 'resources') => void
}) {
  const navigationElement = useRef<HTMLElement>(null)
  const [treeExpansion, setTreeExpansion] = useState(DEFAULT_TREE_EXPANSION)
  const [closeAllFoldersMode, setCloseAllFoldersMode] = useState(false)
  const visibleIds = () => visibleResourceIds(navigationElement.current)
  const query = { parentId: null, lifecycle: 'active' as const }
  const roots = snapshot.list(query)
  const initialFocusId =
    selectedResourceId ??
    (roots.state === 'known'
      ? sortAuthorizedResourceSummaries(roots.items, sort.by, sort.direction)[0]?.id
      : null) ??
    null
  useEffect(
    () =>
      runtime.navigation.subscribe(() => {
        if (view === 'bookmarks') return
        const resourceId = runtime.navigation.current()?.resourceId ?? null
        if (resourceId === null) return
        const ancestorIds = visibleAncestorIds(snapshot, resourceId)
        setTreeExpansion((current) => {
          const initial = closeAllFoldersMode ? DEFAULT_TREE_EXPANSION : current
          return ancestorIds.reduce(
            (next, ancestorId) => setTreeResourceExpanded(next, ancestorId, true),
            initial,
          )
        })
        setCloseAllFoldersMode(false)
      }),
    [closeAllFoldersMode, runtime.navigation, snapshot, view],
  )
  const selectedAncestorIds = new Set(
    closeAllFoldersMode || view === 'bookmarks' || selectedResourceId === null
      ? []
      : visibleAncestorIds(snapshot, selectedResourceId),
  )
  const expansion = {
    isExpanded: (resourceId: ResourceId) =>
      !closeAllFoldersMode &&
      (selectedAncestorIds.has(resourceId) || isTreeResourceExpanded(treeExpansion, resourceId)),
    setExpanded: (resourceId: ResourceId, expanded: boolean) => {
      if (expanded && closeAllFoldersMode) {
        setCloseAllFoldersMode(false)
        setTreeExpansion(setTreeResourceExpanded(DEFAULT_TREE_EXPANSION, resourceId, true))
        return
      }
      setTreeExpansion((current) => setTreeResourceExpanded(current, resourceId, expanded))
    },
  }
  return (
    <nav
      ref={navigationElement}
      aria-label="Sidebar"
      className="flex h-full min-h-0 flex-col bg-background"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 px-1">
        <div className="flex items-center">{slots?.headerStart}</div>
        <strong className="min-w-0 flex-1 truncate px-1 text-sm font-medium">
          {workspaceName ?? 'Resources'}
        </strong>
        <div className="flex items-center">
          {slots?.headerEnd}
          <button
            type="button"
            aria-label="Close sidebar"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={onClose}
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>
      </div>
      <ResourceSidebarControls
        actions={actions}
        canEdit={canEdit}
        runtime={runtime}
        sort={sort}
        view={view}
        closeAllFoldersMode={closeAllFoldersMode}
        onCloseAllFoldersModeChange={() => setCloseAllFoldersMode((current) => !current)}
        onSearch={onSearch}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      />
      <div
        aria-label={`${view} resource drop zone`}
        data-workspace-drop-target="collection"
        className="min-h-0 flex-1 overflow-y-auto p-1 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-ring"
        onDragOver={canEdit ? allowWorkspaceResourceDrop : undefined}
        onDragLeave={canEdit ? leaveWorkspaceResourceDrop : undefined}
        onDrop={
          canEdit
            ? (event) =>
                void finishWorkspaceResourceDrop(event, actions, {
                  type: 'collection',
                  parentId: null,
                  title: workspaceName ?? 'Resources',
                })
            : undefined
        }
        onContextMenu={(event) => {
          if (!canEdit || event.target !== event.currentTarget) return
          event.preventDefault()
          onOpenBackgroundContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        {view === 'bookmarks' ? (
          <BookmarkedResourceCollection
            actions={actions}
            bookmarks={bookmarks}
            canEdit={canEdit}
            renamingResourceId={renamingResourceId}
            selectedResourceId={selectedResourceId}
            selection={selection}
            snapshot={snapshot}
            sort={sort}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onRenamingResourceIdChange={onRenamingResourceIdChange}
          />
        ) : (
          <ResourceCollection
            actions={actions}
            canEdit={canEdit}
            expansion={expansion}
            query={query}
            runtime={runtime}
            renamingResourceId={renamingResourceId}
            initialFocusId={initialFocusId}
            selectedResourceId={selectedResourceId}
            selection={selection}
            snapshot={snapshot}
            sort={sort}
            visibleIds={visibleIds}
            depth={0}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onRenamingResourceIdChange={onRenamingResourceIdChange}
          />
        )}
      </div>
      <div className="m-1 shrink-0">
        <ResourceTrashControl
          actions={actions}
          canEdit={canEdit}
          runtime={runtime}
          snapshot={snapshot}
          sort={sort}
        />
      </div>
      {slots?.footer && <div className="shrink-0 border-t border-border">{slots.footer}</div>}
    </nav>
  )
}

function ResourceSidebarControls({
  actions,
  canEdit,
  closeAllFoldersMode,
  onCloseAllFoldersModeChange,
  onSearch,
  onSortChange,
  onViewChange,
  runtime,
  sort,
  view,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  closeAllFoldersMode: boolean
  onCloseAllFoldersModeChange: () => void
  onSearch: () => void
  onSortChange: (sort: WorkspaceSort) => void
  onViewChange: (view: 'bookmarks' | 'resources') => void
  runtime: EditorRuntime
  sort: WorkspaceSort
  view: 'bookmarks' | 'resources'
}) {
  const searchAvailable = runtime.search.status === 'available'
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-y border-border px-1">
      {canEdit && (
        <ResourceCreateMenu
          actions={actions}
          label="Create resource"
          parentId={null}
          runtime={runtime}
        />
      )}
      {view !== 'bookmarks' && (
        <button
          type="button"
          aria-label={
            closeAllFoldersMode ? 'Exit close-all-folders mode' : 'Enter close-all-folders mode'
          }
          aria-pressed={closeAllFoldersMode}
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
          onClick={onCloseAllFoldersModeChange}
        >
          {closeAllFoldersMode ? (
            <FolderDot className="size-4" />
          ) : (
            <FolderOpenDot className="size-4" />
          )}
        </button>
      )}
      <ResourceSortMenu sort={sort} onSortChange={onSortChange} />
      <div className="flex-1" />
      <button
        type="button"
        aria-label={view === 'bookmarks' ? 'Exit bookmarks' : 'Show bookmarks'}
        aria-pressed={view === 'bookmarks'}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
        disabled={runtime.resources.bookmarks.status !== 'available'}
        onClick={() => onViewChange(view === 'bookmarks' ? 'resources' : 'bookmarks')}
      >
        {view === 'bookmarks' ? (
          <BookmarkCheck className="size-4" />
        ) : (
          <Bookmark className="size-4" />
        )}
      </button>
      <button
        type="button"
        aria-label="Search resources"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        disabled={!searchAvailable}
        title={searchAvailable ? 'Search resources' : 'Search is unavailable in this workspace'}
        onClick={onSearch}
      >
        <Search className="size-4" />
      </button>
    </div>
  )
}

function ResourceSortMenu({
  onSortChange,
  sort,
}: {
  onSortChange: (sort: WorkspaceSort) => void
  sort: WorkspaceSort
}) {
  const value = `${sort.by}:${sort.direction}`
  const options = [
    { value: 'title:ascending', label: 'File name (A to Z)' },
    { value: 'title:descending', label: 'File name (Z to A)' },
    { value: 'updated:descending', label: 'Modified time (new to old)' },
    { value: 'updated:ascending', label: 'Modified time (old to new)' },
    { value: 'created:descending', label: 'Created time (new to old)' },
    { value: 'created:ascending', label: 'Created time (old to new)' },
  ] as const
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Sort resources"
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ArrowUpDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(nextValue) => {
            const nextSort = parseWorkspaceSort(nextValue)
            if (nextSort) onSortChange(nextSort)
          }}
        >
          {options.map((option, index) => (
            <Fragment key={option.value}>
              {(index === 2 || index === 4) && <DropdownMenuSeparator />}
              <DropdownMenuRadioItem value={option.value}>{option.label}</DropdownMenuRadioItem>
            </Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function BookmarkedResourceCollection({
  actions,
  bookmarks,
  canEdit,
  onOpenContextMenu,
  onRenamingResourceIdChange,
  onSelectionChange,
  selectedResourceId,
  renamingResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
}: {
  actions: WorkspaceActions
  bookmarks: ResourceKnowledge<ReadonlySet<ResourceId>>
  canEdit: boolean
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onRenamingResourceIdChange: (resourceId: ResourceId | null) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  renamingResourceId: ResourceId | null
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  const bookmarkedIds = bookmarks.state === 'known' ? bookmarks.value : EMPTY_BOOKMARKS
  if (bookmarks.state === 'unknown')
    return (
      <SidebarState
        load={{ loading: true, result: null, retry: () => {} }}
        pendingLabel="Loading bookmarks…"
      />
    )
  const ids = [...bookmarkedIds]
  const resources = sortAuthorizedResourceSummaries(
    ids.flatMap((resourceId) => {
      const knowledge = snapshot.lookup(resourceId)
      return knowledge.state === 'known' && knowledge.value.lifecycle === 'active'
        ? [knowledge.value]
        : []
    }),
    sort.by,
    sort.direction,
  )
  if (resources.length === 0) {
    return null
  }
  const initialFocusId = selectedResourceId ?? resources[0]?.id ?? null
  const ambiguous = duplicateResourceKeys(resources)
  const selectedIds = new Set(selection.selectedIds)
  return (
    <ul className="space-y-0.5">
      {resources.map((resource) => (
        <li key={resource.id}>
          <div
            aria-current={selectedResourceId === resource.id ? 'page' : undefined}
            data-selected={selectedIds.has(resource.id)}
            className="group flex min-w-0 items-center rounded-md px-1 hover:bg-muted/70 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
          >
            <ResourceAppearanceButton actions={actions} canEdit={canEdit} resource={resource} />
            <ResourceTreeButton
              actions={actions}
              ambiguous={ambiguous.has(resourcePresentationKey(resource))}
              canEdit={canEdit}
              expansion={{ status: 'unavailable' }}
              initialFocusId={initialFocusId}
              renaming={renamingResourceId === resource.id}
              resource={resource}
              selectedResourceId={selectedResourceId}
              selection={selection}
              showIcon={false}
              visibleIds={visibleIds}
              onSelectionChange={onSelectionChange}
              onOpenContextMenu={onOpenContextMenu}
              onRenamingChange={(renaming) =>
                onRenamingResourceIdChange(renaming ? resource.id : null)
              }
            />
            {renamingResourceId !== resource.id && (
              <ResourceRowMenuButton resource={resource} onOpenContextMenu={onOpenContextMenu} />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

function ResourceCollection({
  actions,
  canEdit,
  expansion,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onRenamingResourceIdChange,
  query,
  runtime,
  renamingResourceId,
  selectedResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
  depth,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  expansion: ResourceTreeExpansionController
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onRenamingResourceIdChange: (resourceId: ResourceId | null) => void
  query: ResourceCollectionQuery
  runtime: EditorRuntime
  renamingResourceId: ResourceId | null
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
  depth: number
}) {
  const collection = snapshot.list(query)
  const load = useEnsureResourceCollection(
    runtime.resources.loader,
    query,
    collection.state === 'unknown',
  )
  if (collection.state === 'unknown') {
    return <SidebarState load={load} pendingLabel="Loading resources…" />
  }
  if (collection.items.length === 0 && collection.complete) {
    return null
  }

  const items = sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
  const ambiguous = duplicateResourceKeys(items)
  return (
    <ul className="space-y-0.5">
      {items.map((resource) => (
        <ResourceTreeRow
          actions={actions}
          ambiguous={ambiguous.has(resourcePresentationKey(resource))}
          canEdit={canEdit}
          expansion={expansion}
          key={resource.id}
          resource={resource}
          runtime={runtime}
          renamingResourceId={renamingResourceId}
          initialFocusId={initialFocusId}
          selectedResourceId={selectedResourceId}
          selection={selection}
          snapshot={snapshot}
          sort={sort}
          visibleIds={visibleIds}
          depth={depth}
          onSelectionChange={onSelectionChange}
          onOpenContextMenu={onOpenContextMenu}
          onRenamingResourceIdChange={onRenamingResourceIdChange}
        />
      ))}
      {!collection.complete && (
        <li className="px-2 py-1">
          <button type="button" className="text-xs underline" onClick={load.retry}>
            {load.result?.status === 'failed'
              ? 'Try loading resources again'
              : 'Load more resources'}
          </button>
        </li>
      )}
    </ul>
  )
}

function ResourceTreeRow({
  actions,
  ambiguous,
  canEdit,
  expansion,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onRenamingResourceIdChange,
  resource,
  renamingResourceId,
  runtime,
  selectedResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
  depth,
}: {
  actions: WorkspaceActions
  ambiguous: boolean
  canEdit: boolean
  expansion: ResourceTreeExpansionController
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onRenamingResourceIdChange: (resourceId: ResourceId | null) => void
  renamingResourceId: ResourceId | null
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
  depth: number
}) {
  const expanded = expansion.isExpanded(resource.id)
  const childQuery = { parentId: resource.id, lifecycle: resource.lifecycle } as const

  return (
    <li
      {...workspaceResourceDropTargetProps({ actions, canEdit, resource })}
      className="relative rounded-md data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-inset data-[drop-target=true]:ring-ring"
    >
      <div
        aria-current={selectedResourceId === resource.id ? 'page' : undefined}
        data-resource-kind={resource.kind}
        data-selected={selection.selectedIds.includes(resource.id)}
        className="group relative flex min-w-0 items-center rounded-md pr-1 hover:bg-muted/70 aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
        style={{ paddingLeft: `${4 + depth * 12}px` }}
      >
        {resource.kind === 'folder' ? (
          <FolderExpansionButton
            expanded={expanded}
            resource={resource}
            title={resource.title}
            onToggle={() => expansion.setExpanded(resource.id, !expanded)}
          />
        ) : (
          <ResourceAppearanceButton actions={actions} canEdit={canEdit} resource={resource} />
        )}
        <ResourceTreeButton
          actions={actions}
          ambiguous={ambiguous}
          canEdit={canEdit}
          expansion={{
            status: 'available',
            expanded,
            onChange: (value) => expansion.setExpanded(resource.id, value),
          }}
          initialFocusId={initialFocusId}
          renaming={renamingResourceId === resource.id}
          onSelectionChange={onSelectionChange}
          onOpenContextMenu={onOpenContextMenu}
          onRenamingChange={(renaming) => onRenamingResourceIdChange(renaming ? resource.id : null)}
          resource={resource}
          selectedResourceId={selectedResourceId}
          selection={selection}
          showIcon={false}
          visibleIds={visibleIds}
        />
        {renamingResourceId !== resource.id && (
          <ResourceRowMenuButton resource={resource} onOpenContextMenu={onOpenContextMenu} />
        )}
      </div>
      {resource.kind === 'folder' && expanded && (
        <ResourceCollection
          actions={actions}
          canEdit={canEdit}
          expansion={expansion}
          query={childQuery}
          runtime={runtime}
          renamingResourceId={renamingResourceId}
          initialFocusId={initialFocusId}
          selectedResourceId={selectedResourceId}
          selection={selection}
          snapshot={snapshot}
          sort={sort}
          visibleIds={visibleIds}
          depth={depth + 1}
          onSelectionChange={onSelectionChange}
          onOpenContextMenu={onOpenContextMenu}
          onRenamingResourceIdChange={onRenamingResourceIdChange}
        />
      )}
    </li>
  )
}

function ResourceRowMenuButton({
  onOpenContextMenu,
  resource,
}: {
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  resource: AuthorizedResourceSummary
}) {
  return (
    <div className="flex w-0 shrink-0 items-center overflow-hidden opacity-0 group-hover:w-auto group-hover:overflow-visible group-hover:opacity-100 focus-within:w-auto focus-within:overflow-visible focus-within:opacity-100">
      <button
        type="button"
        aria-label={`More options for ${resource.title}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        onClick={(event) => {
          event.stopPropagation()
          onOpenContextMenu(resourceContextMenuRequest(event, resource, 'sidebar'))
        }}
      >
        <MoreHorizontal className="size-4" />
      </button>
    </div>
  )
}

function FolderExpansionButton({
  expanded,
  onToggle,
  resource,
  title,
}: {
  expanded: boolean
  onToggle: () => void
  resource: AuthorizedResourceSummary
  title: string
}) {
  const Icon = resourceDisplayIcon(resource)
  return (
    <button
      type="button"
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      aria-expanded={expanded}
      className="relative inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      onClick={onToggle}
    >
      <Icon
        className="size-4 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0"
        style={{ color: resource.color ?? undefined }}
      />
      {expanded ? (
        <ChevronDown className="absolute size-3.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
      ) : (
        <ChevronRight className="absolute size-3.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" />
      )}
    </button>
  )
}

function ResourceAppearanceButton({
  actions,
  canEdit,
  resource,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  resource: AuthorizedResourceSummary
}) {
  const Icon = resourceDisplayIcon(resource)
  if (!canEdit) {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground">
        <Icon className="size-4" style={{ color: resource.color ?? undefined }} />
      </span>
    )
  }
  return (
    <ResourceAppearancePopover
      actions={actions}
      resource={resource}
      side="right"
      trigger={
        <button
          type="button"
          aria-label={`Edit icon and color for ${resource.title}`}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon className="size-4" style={{ color: resource.color ?? undefined }} />
        </button>
      }
    />
  )
}

function ResourceTreeButton({
  actions,
  ambiguous,
  canEdit,
  expansion,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onRenamingChange,
  renaming,
  resource,
  selectedResourceId,
  selection,
  showIcon = true,
  visibleIds,
}: {
  actions: WorkspaceActions
  ambiguous: boolean
  canEdit: boolean
  expansion: ResourceTreeExpansion
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onRenamingChange: (renaming: boolean) => void
  renaming: boolean
  resource: AuthorizedResourceSummary
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  showIcon?: boolean
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  if (renaming) {
    return (
      <ResourceRenameInput
        actions={actions}
        ariaLabel={`Rename ${resource.title}`}
        className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1 text-sm"
        resource={resource}
        onComplete={() => onRenamingChange(false)}
      />
    )
  }
  const Icon = resourceKindIcon(resource.kind)
  const tabbable =
    selection.focusedId === resource.id ||
    (selection.focusedId === null && initialFocusId === resource.id)
  return (
    <button
      type="button"
      aria-current={selectedResourceId === resource.id ? 'page' : undefined}
      data-resource-id={resource.id}
      data-resource-kind={resource.kind}
      data-selected={selection.selectedIds.includes(resource.id)}
      {...workspaceResourceInteractionProps({
        canEdit,
        contextMenuOrigin: 'sidebar',
        onOpenContextMenu,
        onSelectionChange,
        resource,
        selection,
      })}
      tabIndex={tabbable ? 0 : -1}
      className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={(event) =>
        selectTreeResource({ actions, event, resource, visibleIds, onSelectionChange })
      }
      onKeyDown={(event) =>
        handleTreeResourceKey({
          event,
          expansion,
          actions,
          onSelectionChange,
          resource,
          selection,
          visibleIds,
        })
      }
    >
      {showIcon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate">{resource.title}</span>
      {ambiguous && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {resource.kind} · {resource.id.slice(-6)}
        </span>
      )}
    </button>
  )
}

type TreeResourceInteraction = Readonly<{
  actions: WorkspaceActions
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  visibleIds: () => ReadonlyArray<ResourceId>
}>

function selectTreeResource({
  actions,
  event,
  onSelectionChange,
  resource,
  visibleIds,
}: TreeResourceInteraction & { event: MouseEvent<HTMLButtonElement> }) {
  const intent = workspaceSelectionIntent(event)
  onSelectionChange({ type: 'select', resourceId: resource.id, visibleIds: visibleIds(), intent })
  if (intent === 'single') actions.open(resource.id)
}

function handleTreeResourceKey({
  actions,
  event,
  expansion,
  onSelectionChange,
  resource,
  selection,
  visibleIds,
}: TreeResourceInteraction & {
  event: KeyboardEvent<HTMLButtonElement>
  expansion: ResourceTreeExpansion
  selection: WorkspaceSelection
}) {
  switch (event.key) {
    case 'ArrowLeft':
      if (resource.kind === 'folder' && expansion.status === 'available' && expansion.expanded) {
        consumeKey(event, () => expansion.onChange(false))
      }
      return
    case 'ArrowRight':
      if (resource.kind === 'folder' && expansion.status === 'available' && !expansion.expanded) {
        consumeKey(event, () => expansion.onChange(true))
      }
      return
    case 'Enter':
      consumeKey(event, () => actions.open(resource.id))
      return
    case ' ':
      consumeKey(event, () =>
        onSelectionChange({
          type: 'select',
          resourceId: resource.id,
          visibleIds: visibleIds(),
          intent: 'toggle',
        }),
      )
      return
    case 'Escape':
      consumeKey(event, () => onSelectionChange({ type: 'clear' }))
      return
    case 'ArrowUp':
    case 'ArrowDown':
      moveTreeResourceFocus(event, selection, visibleIds(), onSelectionChange)
  }
}

function moveTreeResourceFocus(
  event: KeyboardEvent<HTMLButtonElement>,
  selection: WorkspaceSelection,
  visibleIds: ReadonlyArray<ResourceId>,
  onSelectionChange: (action: WorkspaceSelectionAction) => void,
) {
  event.preventDefault()
  const action: WorkspaceSelectionAction = {
    type: 'moveFocus',
    direction: event.key === 'ArrowUp' ? 'previous' : 'next',
    visibleIds,
    extend: event.shiftKey,
  }
  const next = updateWorkspaceSelection(selection, action)
  onSelectionChange(action)
  focusResourceButton(event.currentTarget.closest('nav'), next.focusedId)
}

function consumeKey(event: KeyboardEvent<HTMLButtonElement>, action: () => void) {
  event.preventDefault()
  action()
}

function visibleResourceIds(navigation: HTMLElement | null) {
  if (!navigation) return []
  return [...navigation.querySelectorAll<HTMLButtonElement>('[data-resource-id]')].map((button) =>
    assertDomainId(DOMAIN_ID_KIND.resource, button.dataset.resourceId ?? ''),
  )
}

function focusResourceButton(navigation: HTMLElement | null, resourceId: ResourceId | null) {
  if (!navigation || !resourceId) return
  for (const button of navigation.querySelectorAll<HTMLButtonElement>('[data-resource-id]')) {
    if (button.dataset.resourceId === resourceId) {
      button.focus()
      return
    }
  }
}

export function ResourceCreateMenu({
  actions,
  label,
  parentId,
  runtime,
  variant = 'icon',
}: {
  actions: WorkspaceActions
  label: string
  parentId: ResourceId | null
  runtime: EditorRuntime
  variant?: 'card' | 'icon'
}) {
  const [open, setOpen] = useState(false)
  const creation = useWorkspaceCreation(runtime.scope.campaignId, runtime.navigation, parentId)
  const blocked = creation.blocked
  return (
    <div className={variant === 'card' ? 'relative h-[140px]' : 'relative'}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        disabled={blocked}
        className={
          variant === 'card'
            ? 'flex h-full w-full items-center justify-center rounded-md border border-dashed border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
            : 'inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground'
        }
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute left-0 z-30 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md ${
            variant === 'card' ? 'top-full mt-1' : 'top-8'
          }`}
        >
          {(
            [
              RESOURCE_KIND.note,
              RESOURCE_KIND.folder,
              RESOURCE_KIND.map,
              RESOURCE_KIND.canvas,
              RESOURCE_KIND.file,
            ] as const
          ).map((kind) => {
            const Icon = resourceKindIcon(kind)
            const isPending = creation.pendingControlId === kind
            return (
              <button
                key={kind}
                role="menuitem"
                type="button"
                aria-busy={isPending}
                disabled={blocked}
                className="flex h-8 w-full items-center gap-2 rounded px-2 text-sm hover:bg-muted"
                onClick={async () => {
                  const settlement = await creation.run(kind, (signal) =>
                    actions.create(kind, parentId, '', signal),
                  )
                  if (settlement.status === 'completed') {
                    setOpen(false)
                  }
                }}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Icon className="size-4" />
                )}
                {resourceKindLabel(kind)}
              </button>
            )
          })}
          <WorkspaceCreationStatus
            creation={creation}
            onCompleted={() => {
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function SidebarState({
  load,
  pendingLabel,
}: {
  load: ReturnType<typeof useEnsureResourceCollection>
  pendingLabel: string
}) {
  const result = load.result
  if (!result || result.status === 'completed') {
    return (
      <div aria-label={pendingLabel} className="space-y-2 p-2">
        {[72, 52, 84, 64, 76].map((width) => (
          <div
            key={width}
            className="h-5 animate-pulse rounded bg-muted"
            style={{ width: `${width}%` }}
          />
        ))}
      </div>
    )
  }
  if (result.status === 'scope_changed') return <p className="p-2 text-xs">Workspace changed</p>
  if (result.status === 'unavailable') {
    return <p className="p-2 text-xs text-muted-foreground">Resources unavailable</p>
  }
  return (
    <div className="p-2 text-xs text-muted-foreground">
      <p>{result.retryable ? 'Could not load resources.' : 'Resources are unavailable.'}</p>
      {result.retryable && (
        <button type="button" className="mt-1 underline" onClick={load.retry}>
          Try again
        </button>
      )}
    </div>
  )
}
