import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { ChevronDown, ChevronRight, File, PanelLeftClose, Plus, Search, Star } from 'lucide-react'
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
  workspaceResourceDragProps,
} from '../workspace-resource-drag'
import { createWorkspaceResource, resourceKindLabel } from './resource-operations'
import type { WorkspaceReport } from './resource-operations'
import { resourceContextMenuRequest } from './resource-context-menu-request'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import { useEnsureResourceCollection } from './resource-loading'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'
import { ResourceTrashControl } from './resource-trash-control'

const EMPTY_BOOKMARKS: ReadonlySet<ResourceId> = new Set()

type ResourceTreeExpansion =
  | Readonly<{ status: 'unavailable' }>
  | Readonly<{ status: 'available'; expanded: boolean; onChange: (expanded: boolean) => void }>

export function ResourceSidebar({
  bookmarks,
  canEdit,
  onClose,
  onReport,
  onOpenContextMenu,
  onSearch,
  onSelectionChange,
  onSortChange,
  runtime,
  selectedResourceId,
  selection,
  slots,
  snapshot,
  sort,
  view,
  workspaceName,
  onViewChange,
}: {
  bookmarks: ResourceKnowledge<ReadonlySet<ResourceId>>
  canEdit: boolean
  onClose: () => void
  onReport: WorkspaceReport
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSearch: () => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onSortChange: (sort: WorkspaceSort) => void
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  slots?: Readonly<{ footer?: ReactNode; headerEnd?: ReactNode; headerStart?: ReactNode }>
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  view: 'bookmarks' | 'resources' | 'trash'
  workspaceName: string | null
  onViewChange: (view: 'bookmarks' | 'resources' | 'trash') => void
}) {
  const navigationElement = useRef<HTMLElement>(null)
  const visibleIds = () => visibleResourceIds(navigationElement.current)
  const lifecycle = view === 'trash' ? 'trashed' : 'active'
  const query = { parentId: null, lifecycle } as const
  const roots = snapshot.list(query)
  const initialFocusId =
    selectedResourceId ??
    (roots.state === 'known'
      ? sortAuthorizedResourceSummaries(roots.items, sort.by, sort.direction)[0]?.id
      : null) ??
    null
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
      <div className="flex h-9 shrink-0 items-center gap-1 border-y border-border px-1">
        {canEdit && (
          <ResourceCreateMenu
            label="Create resource"
            parentId={null}
            runtime={runtime}
            onReport={onReport}
          />
        )}
        <button
          type="button"
          aria-label="Search resources"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          disabled={runtime.search.status !== 'available'}
          title={
            runtime.search.status === 'available'
              ? 'Search resources'
              : 'Search is unavailable in this workspace'
          }
          onClick={onSearch}
        >
          <Search className="size-4" />
        </button>
        <div className="flex-1" />
        <label className="sr-only" htmlFor="workspace-resource-sort">
          Sort resources
        </label>
        <select
          id="workspace-resource-sort"
          aria-label="Sort resources"
          className="h-7 max-w-28 rounded-md border-0 bg-transparent px-1 text-xs text-muted-foreground hover:bg-muted"
          value={`${sort.by}:${sort.direction}`}
          onChange={(event) => {
            const [by, direction] = event.target.value.split(':')
            if (
              (by === 'created' || by === 'title' || by === 'updated') &&
              (direction === 'ascending' || direction === 'descending')
            ) {
              onSortChange({ by, direction })
            }
          }}
        >
          <option value="title:ascending">Title A–Z</option>
          <option value="title:descending">Title Z–A</option>
          <option value="updated:descending">Recently edited</option>
          <option value="created:descending">Recently created</option>
        </select>
      </div>
      <div
        aria-label={`${view} resource drop zone`}
        className="min-h-0 flex-1 overflow-y-auto p-1 data-[drop-target=true]:bg-muted/40"
        onDragOver={canEdit ? allowWorkspaceResourceDrop : undefined}
        onDragLeave={canEdit ? leaveWorkspaceResourceDrop : undefined}
        onDrop={
          canEdit
            ? (event) => void finishWorkspaceResourceDrop(event, runtime, null, onReport)
            : undefined
        }
      >
        {view === 'bookmarks' ? (
          <BookmarkedResourceCollection
            bookmarks={bookmarks}
            canEdit={canEdit}
            runtime={runtime}
            selectedResourceId={selectedResourceId}
            selection={selection}
            snapshot={snapshot}
            sort={sort}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onReport={onReport}
          />
        ) : (
          <ResourceCollection
            canEdit={canEdit}
            query={query}
            runtime={runtime}
            initialFocusId={initialFocusId}
            selectedResourceId={selectedResourceId}
            selection={selection}
            snapshot={snapshot}
            sort={sort}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onReport={onReport}
          />
        )}
      </div>
      <div className="m-1 grid shrink-0 grid-cols-2 gap-1">
        <button
          type="button"
          aria-pressed={view === 'bookmarks'}
          className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
          disabled={runtime.resources.bookmarks.status !== 'available'}
          onClick={() => onViewChange(view === 'bookmarks' ? 'resources' : 'bookmarks')}
        >
          <Star className="size-4" />
          Bookmarks
        </button>
        <ResourceTrashControl
          canEdit={canEdit}
          runtime={runtime}
          snapshot={snapshot}
          sort={sort}
          view={view}
          onReport={onReport}
          onViewChange={onViewChange}
        />
      </div>
      {slots?.footer && <div className="shrink-0 border-t border-border">{slots.footer}</div>}
    </nav>
  )
}

function BookmarkedResourceCollection({
  bookmarks,
  canEdit,
  onOpenContextMenu,
  onReport,
  onSelectionChange,
  runtime,
  selectedResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
}: {
  bookmarks: ResourceKnowledge<ReadonlySet<ResourceId>>
  canEdit: boolean
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onReport: WorkspaceReport
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  const bookmarkedIds = bookmarks.state === 'known' ? bookmarks.value : EMPTY_BOOKMARKS
  useEffect(() => {
    void Promise.all(
      [...bookmarkedIds].map((resourceId) => runtime.resources.loader.ensureResource(resourceId)),
    )
  }, [bookmarkedIds, runtime.resources.loader])
  if (bookmarks.state === 'unknown')
    return (
      <SidebarState load={{ result: null, retry: () => {} }} pendingLabel="Loading bookmarks…" />
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
    return <p className="px-2 py-3 text-xs text-muted-foreground">No bookmarked resources</p>
  }
  const initialFocusId = selectedResourceId ?? resources[0]?.id ?? null
  const ambiguous = duplicateResourceKeys(resources)
  return (
    <ul className="space-y-0.5">
      {resources.map((resource) => (
        <li
          key={resource.id}
          className="group flex min-w-0 items-center rounded-md hover:bg-muted/70"
        >
          <span className="size-6 shrink-0" />
          <ResourceTreeButton
            ambiguous={ambiguous.has(resourcePresentationKey(resource))}
            canEdit={canEdit}
            expansion={{ status: 'unavailable' }}
            initialFocusId={initialFocusId}
            resource={resource}
            runtime={runtime}
            selectedResourceId={selectedResourceId}
            selection={selection}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onReport={onReport}
          />
        </li>
      ))}
    </ul>
  )
}

function ResourceCollection({
  canEdit,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onReport,
  query,
  runtime,
  selectedResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
}: {
  canEdit: boolean
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onReport: WorkspaceReport
  query: ResourceCollectionQuery
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  const load = useEnsureResourceCollection(runtime, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') {
    return <SidebarState load={load} pendingLabel="Loading resources…" />
  }
  if (collection.items.length === 0 && collection.complete) {
    return <p className="px-2 py-3 text-xs text-muted-foreground">No resources</p>
  }

  const items = sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
  const ambiguous = duplicateResourceKeys(items)
  return (
    <ul className="space-y-0.5">
      {items.map((resource) => (
        <ResourceTreeRow
          ambiguous={ambiguous.has(resourcePresentationKey(resource))}
          canEdit={canEdit}
          key={resource.id}
          resource={resource}
          runtime={runtime}
          initialFocusId={initialFocusId}
          selectedResourceId={selectedResourceId}
          selection={selection}
          snapshot={snapshot}
          sort={sort}
          visibleIds={visibleIds}
          onSelectionChange={onSelectionChange}
          onOpenContextMenu={onOpenContextMenu}
          onReport={onReport}
        />
      ))}
      {!collection.complete && (
        <li className="px-2 py-1 text-xs text-muted-foreground">More resources may be available</li>
      )}
    </ul>
  )
}

function ResourceTreeRow({
  ambiguous,
  canEdit,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onReport,
  resource,
  runtime,
  selectedResourceId,
  selection,
  snapshot,
  sort,
  visibleIds,
}: {
  ambiguous: boolean
  canEdit: boolean
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  const [expanded, setExpanded] = useState(true)
  const childQuery = { parentId: resource.id, lifecycle: resource.lifecycle } as const
  const children = resource.kind === 'folder' ? snapshot.list(childQuery) : null
  const hasChildren = children?.state !== 'known' || children.items.length > 0

  return (
    <li>
      <div className="group flex min-w-0 items-center rounded-md hover:bg-muted/70">
        {resource.kind === 'folder' ? (
          <FolderExpansionButton
            expanded={expanded}
            hasChildren={hasChildren}
            title={resource.title}
            onToggle={() => setExpanded((value) => !value)}
          />
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <ResourceTreeButton
          ambiguous={ambiguous}
          canEdit={canEdit}
          expansion={{ status: 'available', expanded, onChange: setExpanded }}
          initialFocusId={initialFocusId}
          onSelectionChange={onSelectionChange}
          onOpenContextMenu={onOpenContextMenu}
          onReport={onReport}
          resource={resource}
          runtime={runtime}
          selectedResourceId={selectedResourceId}
          selection={selection}
          visibleIds={visibleIds}
        />
      </div>
      {resource.kind === 'folder' && expanded && (
        <div className="ml-3 border-l border-border pl-1">
          <ResourceCollection
            canEdit={canEdit}
            query={childQuery}
            runtime={runtime}
            initialFocusId={initialFocusId}
            selectedResourceId={selectedResourceId}
            selection={selection}
            snapshot={snapshot}
            sort={sort}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
            onReport={onReport}
          />
        </div>
      )}
    </li>
  )
}

function FolderExpansionButton({
  expanded,
  hasChildren,
  onToggle,
  title,
}: {
  expanded: boolean
  hasChildren: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <button
      type="button"
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${title}`}
      className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
      onClick={onToggle}
    >
      {hasChildren &&
        (expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />)}
    </button>
  )
}

function ResourceTreeButton({
  ambiguous,
  canEdit,
  expansion,
  initialFocusId,
  onSelectionChange,
  onOpenContextMenu,
  onReport,
  resource,
  runtime,
  selectedResourceId,
  selection,
  visibleIds,
}: {
  ambiguous: boolean
  canEdit: boolean
  expansion: ResourceTreeExpansion
  initialFocusId: ResourceId | null
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onReport: WorkspaceReport
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  selection: WorkspaceSelection
  visibleIds: () => ReadonlyArray<ResourceId>
}) {
  const Icon = resourceKindIcon(resource.kind)
  const selected = selection.selectedIds.includes(resource.id)
  const tabbable =
    selection.focusedId === resource.id ||
    (selection.focusedId === null && initialFocusId === resource.id)
  return (
    <button
      type="button"
      aria-current={selectedResourceId === resource.id ? 'page' : undefined}
      data-resource-id={resource.id}
      data-selected={selected}
      {...workspaceResourceDragProps({
        canEdit,
        onReport,
        onSelectionChange,
        resource,
        runtime,
        selection,
      })}
      tabIndex={tabbable ? 0 : -1}
      className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-ring data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
      onClick={(event) =>
        selectTreeResource({ event, resource, runtime, visibleIds, onSelectionChange })
      }
      onContextMenu={(event) => {
        onOpenContextMenu(resourceContextMenuRequest(event, resource))
      }}
      onFocus={() => onSelectionChange({ type: 'focus', resourceId: resource.id })}
      onKeyDown={(event) =>
        handleTreeResourceKey({
          event,
          expansion,
          onSelectionChange,
          resource,
          runtime,
          selection,
          visibleIds,
        })
      }
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
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
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  visibleIds: () => ReadonlyArray<ResourceId>
}>

function selectTreeResource({
  event,
  onSelectionChange,
  resource,
  runtime,
  visibleIds,
}: TreeResourceInteraction & { event: MouseEvent<HTMLButtonElement> }) {
  const intent = workspaceSelectionIntent(event)
  onSelectionChange({ type: 'select', resourceId: resource.id, visibleIds: visibleIds(), intent })
  if (intent === 'single') runtime.navigation.open(resource.id)
}

function handleTreeResourceKey({
  event,
  expansion,
  onSelectionChange,
  resource,
  runtime,
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
      consumeKey(event, () => runtime.navigation.open(resource.id))
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
  label,
  onReport,
  parentId,
  runtime,
}: {
  label: string
  onReport: WorkspaceReport
  parentId: ResourceId | null
  runtime: EditorRuntime
}) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
      >
        <Plus className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-8 z-30 w-56 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <input
            autoFocus
            aria-label="New resource title"
            className="mb-1 h-8 w-full rounded border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="Optional title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          {(
            [
              RESOURCE_KIND.note,
              RESOURCE_KIND.folder,
              RESOURCE_KIND.map,
              RESOURCE_KIND.canvas,
            ] as const
          ).map((kind) => {
            const Icon = resourceKindIcon(kind)
            return (
              <button
                key={kind}
                role="menuitem"
                type="button"
                className="flex h-8 w-full items-center gap-2 rounded px-2 text-sm hover:bg-muted"
                onClick={() => {
                  setOpen(false)
                  void createWorkspaceResource(runtime, kind, parentId, title, onReport)
                }}
              >
                <Icon className="size-4" />
                {resourceKindLabel(kind)}
              </button>
            )
          })}
          <button
            role="menuitem"
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded px-2 text-sm text-muted-foreground"
            disabled
          >
            <File className="size-4" />
            Upload file
          </button>
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
