import { useEffect, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { CanvasReadonlyPreview } from '../../canvas/canvas-readonly-preview'
import type { CanvasDocumentNode } from '../../canvas/document-contract'
import { canvasEmbedLabel } from '../../canvas/canvas-embed-label'
import { NoteSessionEditor } from '../../notes/note-session-editor'
import { EPHEMERAL_NOTE_SCROLL } from '../../notes/note-scroll-persistence'
import type { CanvasPreviewSource, NoteSessionSource } from '../content-session-contract'
import type { ResourceIndexLoader, WorkspaceResourceIndex } from '../resource-index-contract'
import type { ResourceId } from '../domain-id'

const MISSING_RESOURCE = { state: 'missing' as const }

export function CanvasResourceEmbed({
  canEdit,
  canvases,
  editing,
  index,
  loader,
  node,
  notes,
  onEdit,
}: {
  canEdit: boolean
  canvases: CanvasPreviewSource
  editing: boolean
  index: WorkspaceResourceIndex
  loader: ResourceIndexLoader
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  notes: NoteSessionSource
  onEdit: () => void
}) {
  const resourceId =
    node.data.destination?.kind === 'internal' ? node.data.destination.target.resourceId : null
  const snapshot = useSyncExternalStore(
    (listener) => index.subscribe(listener),
    () => index.getSnapshot(),
    () => index.getSnapshot(),
  )
  const resource = resourceId ? snapshot.lookup(resourceId) : MISSING_RESOURCE

  useEffect(() => {
    if (resourceId && resource.state === 'unknown') void loader.ensureResource(resourceId)
  }, [loader, resource.state, resourceId])

  if (resource.state !== 'known') return <CanvasEmbedFallback node={node} />
  if (resource.value.kind === 'note') {
    return (
      <CanvasNoteResourceEmbed
        canEdit={canEdit}
        editing={editing}
        label={`${resource.value.title} embedded note`}
        notes={notes}
        onEdit={onEdit}
        resourceId={resource.value.id}
      />
    )
  }
  if (resource.value.kind === 'canvas') {
    return <CanvasDocumentResourceEmbed canvases={canvases} resourceId={resource.value.id} />
  }
  return <CanvasEmbedFallback node={node} />
}

function CanvasNoteResourceEmbed({
  canEdit,
  editing,
  label,
  notes,
  onEdit,
  resourceId,
}: {
  canEdit: boolean
  editing: boolean
  label: string
  notes: NoteSessionSource
  onEdit: () => void
  resourceId: ResourceId
}) {
  const state = useContentSnapshot(notes, resourceId)
  if (state.status !== 'initializing' && state.status !== 'ready') {
    return <span className="p-3">Note unavailable</span>
  }
  return (
    <CanvasNoteSurface canEdit={canEdit} editing={editing} onEdit={onEdit}>
      <NoteSessionEditor
        canEdit={editing}
        label={label}
        scroll={EPHEMERAL_NOTE_SCROLL}
        state={state}
      />
    </CanvasNoteSurface>
  )
}

function CanvasNoteSurface({
  canEdit,
  children,
  editing,
  onEdit,
}: {
  canEdit: boolean
  children: ReactNode
  editing: boolean
  onEdit: () => void
}) {
  return (
    <div
      className="flex size-full min-h-0 flex-col overflow-hidden text-left"
      onDoubleClick={
        canEdit && !editing
          ? (event) => {
              event.preventDefault()
              event.stopPropagation()
              onEdit()
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

function CanvasDocumentResourceEmbed({
  canvases,
  resourceId,
}: {
  canvases: CanvasPreviewSource
  resourceId: ResourceId
}) {
  const state = useContentSnapshot(canvases, resourceId)
  return state.status === 'ready' ? (
    <CanvasReadonlyPreview document={state.document} />
  ) : (
    <span className="p-3">Canvas unavailable</span>
  )
}

function CanvasEmbedFallback({ node }: { node: Extract<CanvasDocumentNode, { type: 'embed' }> }) {
  return (
    <span className="flex size-full items-center justify-center p-3 text-center">
      {canvasEmbedLabel(node)}
    </span>
  )
}

function useContentSnapshot<TState>(
  source: Readonly<{
    get(resourceId: ResourceId): TState
    subscribe(resourceId: ResourceId, listener: () => void): () => void
  }>,
  resourceId: ResourceId,
): TState {
  return useSyncExternalStore(
    (listener) => source.subscribe(resourceId, listener),
    () => source.get(resourceId),
    () => source.get(resourceId),
  )
}
