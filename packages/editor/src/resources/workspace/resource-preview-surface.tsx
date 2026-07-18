import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { CanvasReadonlyPreview } from '../../canvas/canvas-readonly-preview'
import { FileEmbedPreview } from '../../files/file-embed-preview'
import { MapEmbedPreview } from '../../maps/map-embed-preview'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import { NoteSessionEditor } from '../../notes/note-session-editor'
import type {
  FileContentState,
  MapPreviewState,
  NoteSessionState,
} from '../content-session-contract'
import type { EditorRuntime } from '../editor-runtime-contract'
import type {
  AuthorizedResourceSummary,
  CollectionKnowledge,
  ResourceLoadResult,
} from '../resource-index-contract'
import { resourceKindIcon } from './resource-presentation'
import { useEnsureResourceCollection } from './resource-loading'
import { useResourceStoreSnapshot, useWorkspaceIndexSnapshot } from './resource-store-snapshot'

type RenderableNoteState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

type ResourceNotePreviewRenderer = (input: {
  resource: AuthorizedResourceSummary
  state: RenderableNoteState
}) => ReactNode

export function ResourcePreviewSurface({
  renderNote,
  resource,
  runtime,
}: {
  renderNote?: ResourceNotePreviewRenderer
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  switch (resource.kind) {
    case 'note':
      return <NoteResourcePreview render={renderNote} resource={resource} runtime={runtime} />
    case 'folder':
      return <FolderResourcePreview resource={resource} runtime={runtime} />
    case 'map':
      return <MapResourcePreview resource={resource} runtime={runtime} />
    case 'file':
      return <FileResourcePreview resource={resource} runtime={runtime} />
    case 'canvas':
      return <CanvasResourcePreview resource={resource} runtime={runtime} />
  }
}

function NoteResourcePreview({
  render,
  resource,
  runtime,
}: {
  render?: ResourceNotePreviewRenderer
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.notes, resource.id)
  if (state.status !== 'initializing' && state.status !== 'ready') {
    return <PreviewContentState kind={resource.kind} state={state} />
  }
  if (render) return render({ resource, state })
  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden text-left">
      <NoteSessionEditor
        canEdit={false}
        formattingToolbar={false}
        label={`${resource.title} note preview`}
        scroll={EPHEMERAL_NOTE_SCROLL}
        state={state}
      />
    </div>
  )
}

function FolderResourcePreview({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const snapshot = useWorkspaceIndexSnapshot(runtime.resources.index)
  const query = { parentId: resource.id, lifecycle: 'active' as const }
  const collection = snapshot.list(query)
  const load = useEnsureResourceCollection(
    runtime.resources.loader,
    query,
    collection.state === 'unknown',
  )
  if (collection.state === 'known' && collection.complete && collection.items.length === 0) {
    return <PreviewState label="Folder is empty" />
  }
  const items = collection.state === 'known' ? collection.items : []
  const continuation = folderContinuation(collection, load.result)
  return (
    <div className="size-full overflow-auto">
      <ul aria-label="Folder contents" className="flex flex-col gap-1 p-2">
        {items.map((item) => {
          const Icon = resourceKindIcon(item.kind)
          return (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-sm"
            >
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{item.title}</span>
            </li>
          )
        })}
        {continuation && (
          <li>
            {continuation.action ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                disabled={load.loading}
                onClick={load.retry}
              >
                {load.loading && <Loader2 className="size-3 animate-spin" />}
                {continuation.label}
              </button>
            ) : (
              <span
                className="block px-2 py-1.5 text-center text-xs text-muted-foreground"
                role="status"
              >
                {continuation.label}
              </span>
            )}
          </li>
        )}
      </ul>
    </div>
  )
}

function MapResourcePreview({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.maps.previews, resource.id)
  return state.status === 'ready' ? (
    <MapEmbedPreview preview={state.preview} title={resource.title} />
  ) : (
    <PreviewContentState kind={resource.kind} state={state} />
  )
}

function FileResourcePreview({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.files, resource.id)
  return state.status === 'ready' ? (
    <FileEmbedPreview
      content={state.content}
      resourceId={resource.id}
      source={runtime.content.files}
      title={resource.title}
      version={state.version}
    />
  ) : (
    <PreviewContentState kind={resource.kind} state={state} />
  )
}

function CanvasResourcePreview({
  resource,
  runtime,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.canvases.previews, resource.id)
  return state.status === 'ready' ? (
    <CanvasReadonlyPreview document={state.document} />
  ) : (
    <PreviewContentState kind={resource.kind} state={state} />
  )
}

function folderContinuation(
  collection: CollectionKnowledge<AuthorizedResourceSummary>,
  result: ResourceLoadResult | null,
): Readonly<{ action: boolean; label: string }> | null {
  if (result?.status === 'failed') {
    return {
      action: result.retryable,
      label: result.retryable ? 'Try loading folder again' : 'Folder could not be loaded',
    }
  }
  if (result?.status === 'unavailable') {
    return { action: false, label: 'Folder preview unavailable' }
  }
  if (result?.status === 'scope_changed') {
    return { action: false, label: 'Folder preview changed' }
  }
  if (collection.state !== 'known') {
    return { action: false, label: 'Loading folder' }
  }
  return collection.complete ? null : { action: true, label: 'Load more resources' }
}

type PreviewPendingState =
  | Exclude<NoteSessionState, RenderableNoteState>
  | Exclude<FileContentState, { status: 'ready' }>
  | Exclude<MapPreviewState, { status: 'ready' }>

function PreviewContentState({
  kind,
  state,
}: {
  kind: AuthorizedResourceSummary['kind']
  state: PreviewPendingState
}) {
  switch (state.status) {
    case 'loading':
      return <PreviewState label={`Loading ${kind}`} />
    case 'initializing':
      return <PreviewState label={`Preparing ${kind}`} />
    case 'empty':
      return <PreviewState label="No visible note content" />
    case 'unavailable':
      return <PreviewState label={`${kind} unavailable`} />
    case 'integrity_error':
      return <PreviewState label={`${kind} could not be verified`} />
  }
}

function PreviewState({ label }: { label: string }) {
  return (
    <span className="flex size-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
      {label}
    </span>
  )
}
