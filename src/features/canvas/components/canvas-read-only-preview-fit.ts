import { getCanvasFitViewport } from '../utils/canvas-fit-view'
import type { CanvasElementSize } from '../system/canvas-element-size'
import type { CanvasEngineSnapshot } from '../system/canvas-engine-types'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { CanvasDocumentNode } from '~/features/canvas/domain/canvas-document'
const DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT: CanvasViewport = { x: 0, y: 0, zoom: 1 }

function selectCanvasReadOnlyPreviewFitNodes(
  snapshot: Pick<CanvasEngineSnapshot, 'nodeIds' | 'nodeLookup'>,
): ReadonlyArray<CanvasDocumentNode> {
  return snapshot.nodeIds.flatMap((nodeId) => {
    const node = snapshot.nodeLookup.get(nodeId)?.node
    return node ? [node] : []
  })
}

export function resolveCanvasReadOnlyPreviewViewport({
  fitPadding,
  maxZoom,
  minZoom,
  size,
  snapshot,
}: {
  fitPadding: number
  maxZoom: number
  minZoom: number
  size: CanvasElementSize
  snapshot: Pick<CanvasEngineSnapshot, 'nodeIds' | 'nodeLookup'>
}): CanvasViewport {
  if (size.width <= 0 || size.height <= 0) {
    return DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT
  }

  return (
    getCanvasFitViewport({
      nodes: selectCanvasReadOnlyPreviewFitNodes(snapshot),
      width: size.width,
      height: size.height,
      minZoom,
      maxZoom,
      padding: fitPadding,
    }) ?? DEFAULT_CANVAS_READ_ONLY_PREVIEW_VIEWPORT
  )
}
