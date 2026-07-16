import { FileUp, Folder } from 'lucide-react'
import { useRef, useState, useSyncExternalStore } from 'react'
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
import {
  allowWorkspaceResourceDrop,
  finishWorkspaceResourceDrop,
  leaveWorkspaceResourceDrop,
  workspaceResourceInteractionProps,
} from '../workspace-resource-drag'
import { useEnsureResourceCollection } from './resource-loading'
import { ResourceCreateMenu } from './resource-sidebar'
import { resourceKindLabel } from './resource-operations'
import type { WorkspaceActions } from './resource-operations'
import type { ResourceContextMenuRequest } from './resource-context-menu-request'
import {
  duplicateResourceKeys,
  resourceKindIcon,
  resourcePresentationKey,
} from './resource-presentation'
import { NoteEditor } from '../../notes/note-editor'
import { CanvasEditor } from '../../canvas/canvas-editor'

export function ResourceViewport({
  actions,
  canEdit,
  onOpenContextMenu,
  onSelectionChange,
  resource,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  actions: WorkspaceActions
  canEdit: boolean
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
        actions={actions}
        canEdit={canEdit}
        folder={resource}
        onOpenContextMenu={onOpenContextMenu}
        onSelectionChange={onSelectionChange}
        runtime={runtime}
        selection={selection}
        snapshot={snapshot}
        sort={sort}
      />
    )
  }
  switch (resource.kind) {
    case 'note':
      return <NoteViewport canEdit={canEdit} resource={resource} runtime={runtime} />
    case 'file':
      return (
        <ResourceContentViewport
          canEdit={canEdit}
          resource={resource}
          source={runtime.content.files}
        />
      )
    case 'map':
      return (
        <ResourceContentViewport
          canEdit={canEdit}
          resource={resource}
          source={runtime.content.maps}
        />
      )
    case 'canvas':
      return <CanvasViewport canEdit={canEdit} resource={resource} runtime={runtime} />
  }
}

function CanvasViewport({
  canEdit,
  resource,
  runtime,
}: {
  canEdit: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useContentSnapshot(runtime.content.canvases, resource.id)
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />
  return (
    <CanvasEditor
      key={`${resource.id}:${state.session.document.guid}`}
      canEdit={canEdit}
      resourceId={resource.id}
      session={state.session}
      title={resource.title}
    />
  )
}

function NoteViewport({
  canEdit,
  resource,
  runtime,
}: {
  canEdit: boolean
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const source = runtime.content.notes
  const state = useContentSnapshot(source, resource.id)
  if (state.status === 'initializing') {
    return canEdit ? (
      <NoteEditor
        document={state.local}
        label={`${resource.title} note editor`}
        mode="edit"
        persistence="initializing"
      />
    ) : (
      <NoteEditor document={state.local} label={`${resource.title} note editor`} mode="view" />
    )
  }
  if (state.status !== 'ready') return <ContentState resource={resource} state={state} />
  return canEdit ? (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={`${resource.title} note editor`}
      mode="edit"
      persistence="ready"
      onFlush={state.session.flush}
    />
  ) : (
    <NoteEditor
      collaboration={state.session.collaboration}
      document={state.session.document}
      label={`${resource.title} note editor`}
      mode="view"
    />
  )
}

type ResourceContentState =
  | ReturnType<EditorRuntime['content']['files']['get']>
  | ReturnType<EditorRuntime['content']['maps']['get']>
  | ReturnType<EditorRuntime['content']['canvases']['get']>

type ResourceContentSource = Readonly<{
  get(resourceId: AuthorizedResourceSummary['id']): ResourceContentState
  subscribe(resourceId: AuthorizedResourceSummary['id'], listener: () => void): () => void
}>

function ResourceContentViewport({
  canEdit,
  resource,
  source,
}: {
  canEdit: boolean
  resource: AuthorizedResourceSummary
  source: ResourceContentSource
}) {
  const state = useContentSnapshot(source, resource.id)
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

function useContentSnapshot<TState>(
  source: Readonly<{
    get(resourceId: AuthorizedResourceSummary['id']): TState
    subscribe(resourceId: AuthorizedResourceSummary['id'], listener: () => void): () => void
  }>,
  resourceId: AuthorizedResourceSummary['id'],
): TState {
  return useSyncExternalStore(
    (listener) => source.subscribe(resourceId, listener),
    () => source.get(resourceId),
    () => source.get(resourceId),
  )
}

function FolderViewport({
  actions,
  canEdit,
  folder,
  onOpenContextMenu,
  onSelectionChange,
  runtime,
  selection,
  snapshot,
  sort,
}: {
  actions: WorkspaceActions
  canEdit: boolean
  folder: AuthorizedResourceSummary
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
      <CreateNewDashboard actions={actions} folder={folder} />
    ) : (
      <ViewportState icon={Folder} title="This folder is empty" />
    )
  }

  const ambiguous = duplicateResourceKeys(resources)
  const selectedIds = new Set(selection.selectedIds)
  const visibleIds = resources.map((resource) => resource.id)
  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto data-[drop-target=true]:bg-muted/40"
      onDragOver={canEdit ? allowWorkspaceResourceDrop : undefined}
      onDragLeave={canEdit ? leaveWorkspaceResourceDrop : undefined}
      onDrop={
        canEdit ? (event) => void finishWorkspaceResourceDrop(event, actions, folder.id) : undefined
      }
    >
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 p-6">
        {resources.map((resource) => (
          <ResourceCard
            actions={actions}
            ambiguous={ambiguous.has(resourcePresentationKey(resource))}
            canEdit={canEdit}
            key={resource.id}
            resource={resource}
            selected={selectedIds.has(resource.id)}
            selection={selection}
            visibleIds={visibleIds}
            onSelectionChange={onSelectionChange}
            onOpenContextMenu={onOpenContextMenu}
          />
        ))}
        {canEdit && (
          <div className="relative flex h-[140px] items-center justify-center rounded-md border border-dashed border-border hover:bg-muted/50">
            <ResourceCreateMenu
              actions={actions}
              label="Create item in this folder"
              parentId={folder.id}
            />
          </div>
        )}
      </div>
      {!collection.complete && (
        <button
          type="button"
          className="mx-6 mb-6 self-start text-sm underline"
          onClick={load.retry}
        >
          {load.result?.status === 'failed' ? 'Try loading resources again' : 'Load more resources'}
        </button>
      )}
    </div>
  )
}

function CreateNewDashboard({
  actions,
  folder,
}: {
  actions: WorkspaceActions
  folder: AuthorizedResourceSummary
}) {
  const [pending, setPending] = useState(false)
  const upload = useRef<HTMLInputElement>(null)
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
                aria-busy={pending}
                disabled={pending}
                className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium shadow-sm hover:bg-muted"
                onClick={() => {
                  const title = `Untitled ${kind}`
                  setPending(true)
                  void actions.create(kind, folder.id, title).finally(() => setPending(false))
                }}
              >
                <Icon className="size-7 text-muted-foreground" />
                {resourceKindLabel(kind)}
              </button>
            )
          })}
          <button
            type="button"
            aria-busy={pending}
            disabled={pending}
            className="flex min-h-28 flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card p-3 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-50"
            onClick={() => upload.current?.click()}
          >
            <FileUp className="size-7 text-muted-foreground" />
            Upload File
          </button>
          <input
            ref={upload}
            type="file"
            className="hidden"
            aria-label={`Upload file to ${folder.title}`}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              setPending(true)
              void actions.createFile(folder.id, file).finally(() => setPending(false))
            }}
          />
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
  actions,
  ambiguous,
  canEdit,
  onSelectionChange,
  onOpenContextMenu,
  resource,
  selected,
  selection,
  visibleIds,
}: {
  actions: WorkspaceActions
  ambiguous: boolean
  canEdit: boolean
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  onOpenContextMenu: (request: ResourceContextMenuRequest) => void
  resource: AuthorizedResourceSummary
  selected: boolean
  selection: WorkspaceSelection
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const Icon = resourceKindIcon(resource.kind)
  const folder = resource.kind === 'folder'
  return (
    <button
      type="button"
      aria-label={resource.title}
      data-selected={selected}
      {...workspaceResourceInteractionProps({
        actions,
        canEdit,
        onOpenContextMenu,
        onSelectionChange,
        resource,
        selection,
      })}
      className={
        folder
          ? 'group relative flex h-[140px] flex-col overflow-hidden rounded-md border border-border bg-muted/60 p-3 pt-5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring'
          : 'group relative flex h-[140px] flex-col overflow-hidden rounded-md border border-border bg-card p-3 text-left shadow-sm outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-ring data-[selected=true]:ring-2 data-[selected=true]:ring-ring'
      }
      onClick={(event) => selectCard({ actions, event, resource, visibleIds, onSelectionChange })}
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
  actions,
  event,
  onSelectionChange,
  resource,
  visibleIds,
}: {
  actions: WorkspaceActions
  event: MouseEvent<HTMLButtonElement>
  onSelectionChange: (action: WorkspaceSelectionAction) => void
  resource: AuthorizedResourceSummary
  visibleIds: ReadonlyArray<AuthorizedResourceSummary['id']>
}) {
  const intent = workspaceSelectionIntent(event)
  onSelectionChange({ type: 'select', resourceId: resource.id, visibleIds, intent })
  if (intent === 'single') actions.open(resource.id)
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
