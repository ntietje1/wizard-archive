import { Folder } from 'lucide-react'
import type { ComponentType, MouseEvent, ReactNode } from 'react'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  ResourceLoadResult,
  WorkspaceResourceIndexSnapshot,
} from '../resource-index-contract'
import { sortAuthorizedResourceSummaries } from '../workspace-resource-index'
import type { WorkspaceSort } from '../workspace-preferences'
import { workspaceSelectionIntent } from '../workspace-selection'
import type { WorkspaceSelection, WorkspaceSelectionAction } from '../workspace-selection'
import { useEnsureResourceCollection } from './resource-loading'
import { ResourceCreateMenu } from './resource-sidebar'
import { createWorkspaceResource, resourceKindLabel } from './resource-operations'
import type { WorkspaceReport } from './resource-operations'
import { resourceContextMenuRequest } from './resource-context-menu-request'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'

export function ResourceViewport({
  canEdit,
  onReport,
  onOpenContextMenu,
  onSelectionChange,
  resource,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  canEdit: boolean
  onReport: WorkspaceReport
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
}) {
  if (resource.lifecycle === 'trashed') {
    return (
      <ViewportState
        icon={resourceKindIcon(resource.kind)}
        title="This resource is in the trash"
        description="Restore it to continue working with its content."
      />
    )
  }
  if (resource.kind === 'folder') {
    return (
      <FolderViewport
        canEdit={canEdit}
        folder={resource}
        onReport={onReport}
        onOpenContextMenu={onOpenContextMenu}
        onSelectionChange={onSelectionChange}
        runtime={runtime}
        selection={selection}
        snapshot={snapshot}
        sort={sort}
      />
    )
  }
  const state = contentState(resource, runtime)
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />

  return (
    <div
      aria-label={`${resourceKindLabel(resource.kind)} content`}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden"
      data-resource-kind={resource.kind}
      data-workspace-mode={canEdit ? 'editor' : 'viewer'}
    />
  )
}

function FolderViewport({
  canEdit,
  folder,
  onReport,
  onOpenContextMenu,
  onSelectionChange,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  canEdit: boolean
  folder: AuthorizedResourceSummary
  onReport: WorkspaceReport
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  runtime: EditorRuntime
  selection: WorkspaceSelection
  snapshot: WorkspaceResourceIndexSnapshot
  sort: WorkspaceSort
}) {
  const query = { parentId: folder.id, lifecycle: 'active' as const }
  const load = useEnsureResourceCollection(runtime, query)
  const collection = snapshot.list(query)
  if (collection.state === 'unknown') return <FolderLoadingState load={load} />

  const resources = sortAuthorizedResourceSummaries(collection.items, sort.by, sort.direction)
  if (resources.length === 0 && collection.complete) {
    return canEdit ? (
      <CreateNewDashboard folder={folder} runtime={runtime} onReport={onReport} />
    ) : (
      <ViewportState icon={Folder} title="This folder is empty" />
    )
  }

  const ambiguous = duplicateResourceKeys(resources)
  const selectedIds = new Set(selection.selectedIds)
  const visibleIds = resources.map((resource) => resource.id)
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6">
        {resources.map((resource) => (
          <ResourceCard
            ambiguous={ambiguous.has(resourcePresentationKey(resource))}
            key={resource.id}
            resource={resource}
            runtime={runtime}
            selected={selectedIds.has(resource.id)}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
          />
        ))}
        {canEdit && (
          <div className="relative flex h-[140px] items-center justify-center rounded-md border border-dashed border-border hover:bg-muted/50">
            <ResourceCreateMenu
              label="Create item in this folder"
              parentId={folder.id}
              runtime={runtime}
              onReport={onReport}
            />
          </div>
        )}
      </div>
      {!collection.complete && (
        <p className="px-6 pb-6 text-sm text-muted-foreground">More resources may be available.</p>
      )}
    </div>
  )
}

function CreateNewDashboard({
  folder,
  onReport,
  runtime,
}: {
  folder: AuthorizedResourceSummary
  onReport: WorkspaceReport
  runtime: EditorRuntime
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-2xl">
        <p className="mb-1 text-center text-sm text-muted-foreground">{folder.title}</p>
        <h2 className="mb-6 text-center text-xl font-semibold">Create New</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(['note', 'folder', 'map', 'canvas'] as const).map((kind) => {
            const Icon = resourceKindIcon(kind)
            return (
              <button
                key={kind}
                type="button"
                className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium shadow-sm hover:bg-muted"
                onClick={() => {
                  const title = `Untitled ${kind}`
                  void createWorkspaceResource(runtime, kind, folder.id, title, onReport)
                }}
              >
                <Icon className="size-7 text-muted-foreground" />
                {resourceKindLabel(kind)}
              </button>
            )
          })}
        </div>
        <div className="mt-8 border-t border-border pt-5 text-center">
          <p className="text-sm font-medium">Create from Template</p>
          <p className="mt-1 text-sm text-muted-foreground">No templates yet</p>
        </div>
      </div>
    </div>
  )
}

function ResourceCard({
  ambiguous,
  onSelectionChange,
  onOpenContextMenu,
  resource,
  runtime,
  selected,
  visibleIds,
}: {
  ambiguous: boolean
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  selected: boolean
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const Icon = resourceKindIcon(resource.kind)
  const folder = resource.kind === 'folder'
  return (
    <button
      type="button"
      aria-label={resource.title}
      data-selected={selected}
      className={
        folder
          ? 'group relative flex h-[140px] flex-col overflow-hidden rounded-md border border-border bg-muted/60 p-3 pt-5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring'
          : 'group relative flex h-[140px] flex-col overflow-hidden rounded-md border border-border bg-card p-3 text-left shadow-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring'
      }
      onClick={(event) => selectCard({ event, resource, visibleIds, runtime, onSelectionChange })}
      onContextMenu={(event) => {
        onOpenContextMenu(resourceContextMenuRequest(event, resource))
      }}
      onFocus={() => onSelectionChange({ type: 'focus', resourceId: resource.id })}
    >
      {folder && (
        <span className="absolute left-0 top-0 h-3 w-20 rounded-tr border-r border-border bg-muted" />
      )}
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{resource.title}</span>
      </span>
      <span className="mt-auto text-xs text-muted-foreground">
        {ambiguous
          ? `${resourceKindLabel(resource.kind)} · ${resource.id.slice(-6)}`
          : resourceKindLabel(resource.kind)}
      </span>
    </button>
  )
}

function selectCard({
  event,
  onSelectionChange,
  resource,
  runtime,
  visibleIds,
}: {
  event: MouseEvent<HTMLButtonElement>
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const intent = workspaceSelectionIntent(event)
  onSelectionChange({ type: 'select', resourceId: resource.id, visibleIds, intent })
  if (intent === 'single') runtime.navigation.open(resource.id)
}

function FolderLoadingState({
  load,
}: {
  load: { result: ResourceLoadResult | null; retry: () => void }
}) {
  if (load.result?.status === 'failed') {
    return (
      <ViewportState
        icon={Folder}
        title="Could not load this folder"
        action={
          load.result.retryable ? (
            <button type="button" className="mt-2 text-sm underline" onClick={load.retry}>
              Try again
            </button>
          ) : null
        }
      />
    )
  }
  return (
    <div aria-label="Loading folder" className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3">
      {[0, 1, 2, 3, 4].map((key) => (
        <div key={key} className="h-[140px] animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

type SessionState =
  | ReturnType<EditorRuntime['content']['notes']['get']>
  | ReturnType<EditorRuntime['content']['files']['get']>
  | ReturnType<EditorRuntime['content']['maps']['get']>
  | ReturnType<EditorRuntime['content']['canvases']['get']>

function contentState(resource: AuthorizedResourceSummary, runtime: EditorRuntime): SessionState {
  switch (resource.kind) {
    case 'note':
      return runtime.content.notes.get(resource.id)
    case 'file':
      return runtime.content.files.get(resource.id)
    case 'map':
      return runtime.content.maps.get(resource.id)
    case 'canvas':
      return runtime.content.canvases.get(resource.id)
    case 'folder':
      throw new TypeError('Folder content is collection-owned')
  }
}

function ContentState({
  resource,
  state,
}: {
  resource: AuthorizedResourceSummary
  state: Exclude<SessionState, { status: 'ready' }>
}) {
  const Icon = resourceKindIcon(resource.kind)
  switch (state.status) {
    case 'loading':
      return <ViewportState icon={Icon} title="Loading content…" />
    case 'initializing':
      return <ViewportState icon={Icon} title="Preparing your note…" />
    case 'unavailable':
      return <ViewportState icon={Icon} title="Content unavailable" description={state.reason} />
    case 'integrity_error':
      return (
        <ViewportState
          icon={Icon}
          title="Content could not be verified"
          description={state.issue}
        />
      )
  }
}

export function ViewportState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description?: string
  icon: ComponentType<{ className?: string }>
  title: string
}) {
  return (
    <div className="flex min-h-72 flex-1 items-center justify-center p-6 text-center">
      <div>
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {action}
      </div>
    </div>
  )
}
