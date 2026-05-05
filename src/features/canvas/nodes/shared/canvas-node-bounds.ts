import { parseCanvasBoundsDimensions } from 'convex/canvases/validation'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasDocumentNode } from 'convex/canvases/validation'

export function getCanvasNodeBounds(node: CanvasDocumentNode): Bounds | null {
  const fallbackBounds =
    typeof node.data === 'object' && node.data !== null && 'bounds' in node.data
      ? node.data.bounds
      : null
  const parsedFallbackBounds = parseCanvasBoundsDimensions(fallbackBounds)
  const width = node.width ?? parsedFallbackBounds?.width ?? null
  const height = node.height ?? parsedFallbackBounds?.height ?? null

  if (width === null || height === null || !Number.isFinite(width) || !Number.isFinite(height)) {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height,
  }
}
