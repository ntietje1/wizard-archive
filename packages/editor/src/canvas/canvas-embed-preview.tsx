import { useSyncExternalStore } from 'react'
import type { CanvasPreviewSource } from '../resources/content-session-contract'
import type { CanvasDocumentNode } from './document-contract'
import { canvasEmbedLabel } from './canvas-embed-label'
import { CanvasReadonlyPreview } from './canvas-readonly-preview'

export function CanvasEmbedPreview({
  node,
  previews,
}: {
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  previews: CanvasPreviewSource
}) {
  const resourceId =
    node.data.destination?.kind === 'internal' ? node.data.destination.target.resourceId : null
  if (!resourceId) return <span className="p-3">{canvasEmbedLabel(node)}</span>
  return <ResolvedCanvasEmbedPreview node={node} previews={previews} resourceId={resourceId} />
}

function ResolvedCanvasEmbedPreview({
  node,
  previews,
  resourceId,
}: {
  node: Extract<CanvasDocumentNode, { type: 'embed' }>
  previews: CanvasPreviewSource
  resourceId: Parameters<CanvasPreviewSource['get']>[0]
}) {
  const state = useSyncExternalStore(
    (listener) => previews.subscribe(resourceId, listener),
    () => previews.get(resourceId),
    () => previews.get(resourceId),
  )
  if (state.status !== 'ready') {
    return <span className="p-3">{canvasEmbedLabel(node)}</span>
  }
  return <CanvasReadonlyPreview document={state.document} />
}
