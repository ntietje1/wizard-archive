import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  File,
  PanelLeftClose,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import type { ResourceId } from '../domain-id'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceCollectionQuery,
  WorkspaceResourceIndexSnapshot,
} from '../resource-index-contract'
import { RESOURCE_KIND } from '../resource-record'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import type { WorkspaceSort } from '../workspace-preferences'
import { createWorkspaceResource, resourceKindLabel } from './resource-operations'
import type { WorkspaceReport } from './resource-operations'
import { useEnsureResourceCollection } from './resource-loading'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'

export function ResourceSidebar({
  canEdit,
  lifecycle,
  onLifecycleChange,
  onClose,
  onReport,
  onSortChange,
  runtime,
  selectedResourceId,
  slots,
  snapshot,
  sort,
  workspaceName,
}: {
  canEdit: boolean
  lifecycle: 'active' | 'trashed'
  onLifecycleChange: (value: 'active' | 'trashed') => void
  onClose: () => void
  onReport: WorkspaceReport
  onSortChange: (sort: WorkspaceSort) => void
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  slots?: Readonly<{ footer?: ReactNode; headerEnd?: ReactNode; headerStart?: ReactNode }>
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
  workspaceName: string | null
}) {
  const query = { parentId: null, lifecycle } as const
  return (
    <nav aria-label="Sidebar" className="flex h-full min-h-0 flex-col bg-background">
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
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        <ResourceCollection
          query={query}
          runtime={runtime}
          selectedResourceId={selectedResourceId}
          snapshot={snapshot}
          sort={sort}
        />
      </div>
      <button
        type="button"
        aria-pressed={lifecycle === 'trashed'}
        className="m-1 flex h-8 shrink-0 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
        onClick={() => onLifecycleChange(lifecycle === 'active' ? 'trashed' : 'active')}
      >
        {lifecycle === 'active' ? <Trash2 className="size-4" /> : <RotateCcw className="size-4" />}
        {lifecycle === 'active' ? 'Trash' : 'Back to resources'}
      </button>
      {slots?.footer && <div className="shrink-0 border-t border-border">{slots.footer}</div>}
    </nav>
  )
}

function ResourceCollection({
  query,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  query: ResourceCollectionQuery
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
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
          key={resource.id}
          resource={resource}
          runtime={runtime}
          selectedResourceId={selectedResourceId}
          snapshot={snapshot}
          sort={sort}
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
  resource,
  runtime,
  selectedResourceId,
  snapshot,
  sort,
}: {
  ambiguous: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selectedResourceId: ResourceId | null
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
}) {
  const [expanded, setExpanded] = useState(true)
  const childQuery = { parentId: resource.id, lifecycle: resource.lifecycle } as const
  const children = resource.kind === 'folder' ? snapshot.list(childQuery) : null
  const hasChildren = children?.state !== 'known' || children.items.length > 0
  const Icon = resourceKindIcon(resource.kind)

  return (
    <li>
      <div className="group flex min-w-0 items-center rounded-md hover:bg-muted/70">
        {resource.kind === 'folder' ? (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${resource.title}`}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {hasChildren ? (
              expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )
            ) : null}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          aria-current={selectedResourceId === resource.id ? 'page' : undefined}
          className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
          onClick={() => runtime.navigation.open(resource.id)}
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{resource.title}</span>
          {ambiguous && (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {resource.kind} · {resource.id.slice(-6)}
            </span>
          )}
        </button>
      </div>
      {resource.kind === 'folder' && expanded && (
        <div className="ml-3 border-l border-border pl-1">
          <ResourceCollection
            query={childQuery}
            runtime={runtime}
            selectedResourceId={selectedResourceId}
            snapshot={snapshot}
            sort={sort}
          />
        </div>
      )}
    </li>
  )
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
