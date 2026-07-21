import { Loader2 } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { ScrollArea } from '@wizard-archive/ui/shadcn/components/scroll-area'
import { NOTE_YJS_FRAGMENT, noteYDocToBlocks } from '../../notes/document/headless-yjs'
import { noteBlocksPlainText } from '../../notes/document/plain-text'
import type { NoteBlock } from '../../notes/document/model'
import { CanvasReadonlyPreview } from '../../canvas/canvas-readonly-preview'
import { FileEmbedPreview } from '../../files/file-embed-preview'
import { MapEmbedPreview } from '../../maps/map-embed-preview'
import type {
  FileContentState,
  MapContentSnapshotState,
  NoteSessionState,
} from '../content-session-contract'
import type { EditorRuntime } from '../editor-runtime-contract'
import type { CanonicalTarget } from '../authored-destination-contract'
import type { EmbedMediaLayoutReporter } from '../embed-media-layout'
import type {
  AuthorizedResourceSummary,
  CollectionKnowledge,
  ResourceLoadResult,
} from '../resource-index-contract'
import { resourceKindIcon } from './resource-icon'
import { useEnsureResourceCollection } from './resource-loading'
import { useResourceStoreSnapshot, useWorkspaceIndexSnapshot } from './resource-store-snapshot'

type RenderableNoteState = Extract<
  NoteSessionState,
  { status: 'initializing' } | { status: 'ready' }
>

type ResourceNotePreviewRenderer = (input: {
  resource: AuthorizedResourceSummary
  state: RenderableNoteState
  target: Extract<CanonicalTarget, { kind: 'noteBlock' | 'resource' }>
}) => ReactNode

type EmbeddedResourceSurfaceProps = {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  onMediaLayout?: EmbedMediaLayoutReporter
  renderNote?: ResourceNotePreviewRenderer
  target?: CanonicalTarget
}

export function EmbeddedResourceSurface(props: EmbeddedResourceSurfaceProps) {
  const { resource, runtime } = props
  const target = props.target ?? { kind: 'resource', resourceId: resource.id }
  if (target.resourceId !== resource.id) {
    throw new TypeError('Resource preview target must belong to the rendered resource')
  }
  switch (resource.kind) {
    case 'note':
      return (
        <EmbeddedNoteResource
          render={props.renderNote}
          resource={resource}
          runtime={runtime}
          target={target}
        />
      )
    case 'folder':
      return target.kind === 'resource' ? (
        <EmbeddedFolderResource resource={resource} runtime={runtime} />
      ) : (
        <EmbeddedContentState label="Target unavailable" />
      )
    case 'map':
      return (
        <EmbeddedMapResource
          onMediaLayout={props.onMediaLayout}
          resource={resource}
          runtime={runtime}
          target={target}
        />
      )
    case 'file':
      return target.kind === 'resource' ? (
        <EmbeddedFileResource
          onMediaLayout={props.onMediaLayout}
          resource={resource}
          runtime={runtime}
        />
      ) : (
        <EmbeddedContentState label="Target unavailable" />
      )
    case 'canvas':
      return <EmbeddedCanvasResource resource={resource} runtime={runtime} target={target} />
  }
}

function EmbeddedNoteResource({
  render,
  resource,
  runtime,
  target,
}: {
  render?: ResourceNotePreviewRenderer
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: CanonicalTarget
}) {
  const state = useResourceStoreSnapshot(runtime.content.notes, resource.id)
  if (target.kind !== 'resource' && target.kind !== 'noteBlock') {
    return <EmbeddedContentState label="Target unavailable" />
  }
  if (state.status !== 'initializing' && state.status !== 'ready') {
    return <EmbeddedResourceState kind={resource.kind} state={state} />
  }
  return render && target.kind === 'resource' ? (
    render({ resource, state, target })
  ) : (
    <StaticEmbeddedNoteResource resource={resource} state={state} target={target} />
  )
}

function StaticEmbeddedNoteResource({
  resource,
  state,
  target,
}: {
  resource: AuthorizedResourceSummary
  state: RenderableNoteState
  target: Extract<CanonicalTarget, { kind: 'noteBlock' | 'resource' }>
}) {
  const session = state.status === 'ready' ? state.session : null
  useEffect(() => session?.retain(), [session])
  const document = state.status === 'ready' ? state.session.document : state.local
  const blocks = noteYDocToBlocks(document, NOTE_YJS_FRAGMENT)
  const targetBlocks = target.kind === 'noteBlock' ? findNoteBlock(blocks, target.blockId) : blocks
  if (!targetBlocks) return <EmbeddedContentState label="Target unavailable" />
  const text = noteBlocksPlainText(targetBlocks)
  return text ? (
    <div
      aria-label={`${resource.title} preview`}
      className="size-full overflow-hidden whitespace-pre-wrap p-3 text-sm leading-relaxed text-foreground"
    >
      {text}
    </div>
  ) : (
    <EmbeddedContentState label="No visible note content" />
  )
}

function EmbeddedFolderResource({
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
    return <EmbeddedContentState label="Empty folder" />
  }
  const items = collection.state === 'known' ? collection.items : []
  const continuation = folderContinuation(collection, load.result)
  return (
    <ScrollArea className="size-full">
      <ul aria-label="Folder contents" className="space-y-1 p-2">
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
    </ScrollArea>
  )
}

function EmbeddedMapResource({
  onMediaLayout,
  resource,
  runtime,
  target,
}: {
  onMediaLayout?: EmbedMediaLayoutReporter
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: CanonicalTarget
}) {
  const state = useResourceStoreSnapshot(runtime.content.maps.snapshots, resource.id)
  if (target.kind !== 'resource' && target.kind !== 'mapPin') {
    return <EmbeddedContentState label="Target unavailable" />
  }
  return state.status === 'ready' ? (
    <MapEmbedPreview
      focusedPinId={target.kind === 'mapPin' ? target.pinId : null}
      onMediaLayout={onMediaLayout}
      preview={state.snapshot}
      title={resource.title}
    />
  ) : (
    <EmbeddedResourceState kind={resource.kind} state={state} />
  )
}

function EmbeddedFileResource({
  onMediaLayout,
  resource,
  runtime,
}: {
  onMediaLayout?: EmbedMediaLayoutReporter
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
}) {
  const state = useResourceStoreSnapshot(runtime.content.files, resource.id)
  return state.status === 'ready' ? (
    <FileEmbedPreview
      content={state.content}
      onMediaLayout={onMediaLayout}
      resourceId={resource.id}
      source={runtime.content.files}
      title={resource.title}
      version={state.version}
    />
  ) : (
    <EmbeddedResourceState kind={resource.kind} state={state} />
  )
}

function EmbeddedCanvasResource({
  resource,
  runtime,
  target,
}: {
  resource: AuthorizedResourceSummary
  runtime: EditorRuntime
  target: CanonicalTarget
}) {
  const state = useResourceStoreSnapshot(runtime.content.canvases.snapshots, resource.id)
  if (target.kind !== 'resource' && target.kind !== 'canvasNode') {
    return <EmbeddedContentState label="Target unavailable" />
  }
  return state.status === 'ready' ? (
    <CanvasReadonlyPreview
      document={state.document}
      focusedNodeId={target.kind === 'canvasNode' ? target.nodeId : null}
    />
  ) : (
    <EmbeddedResourceState kind={resource.kind} state={state} />
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
  | Exclude<MapContentSnapshotState, { status: 'ready' }>

function EmbeddedResourceState({
  kind,
  state,
}: {
  kind: AuthorizedResourceSummary['kind']
  state: PreviewPendingState
}) {
  switch (state.status) {
    case 'loading':
      return <EmbeddedContentState label={`Loading ${kind}`} />
    case 'initializing':
      return <EmbeddedContentState label={`Preparing ${kind}`} />
    case 'empty':
      return <EmbeddedContentState label="No visible note content" />
    case 'unavailable':
      return <EmbeddedContentState label={`${kind} unavailable`} />
    case 'recovery_required':
      return <EmbeddedContentState label={`Open ${kind} to recover unsaved edits`} />
    case 'integrity_error':
      return <EmbeddedContentState label={`${kind} could not be verified`} />
  }
}

function EmbeddedContentState({ label }: { label: string }) {
  return (
    <span className="flex size-full items-center justify-center p-3 text-center text-sm text-muted-foreground">
      {label}
    </span>
  )
}

function findNoteBlock(
  blocks: ReadonlyArray<NoteBlock>,
  blockId: Extract<CanonicalTarget, { kind: 'noteBlock' }>['blockId'],
): ReadonlyArray<NoteBlock> | null {
  for (const block of blocks) {
    if (block.id === blockId) return [block]
    const nested = findNoteBlock(block.children ?? [], blockId)
    if (nested) return nested
  }
  return null
}
