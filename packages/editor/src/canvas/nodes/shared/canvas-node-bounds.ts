import { parseCanvasBoundsDimensions } from '../../geometry'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { CanvasDocumentNode } from '../../document-contract'
export function getCanvasNodeBounds(node: CanvasDocumentNode): Bounds | null {
  const fallbackBounds =
    typeof node.data === 'object' && node.data !== null && 'bounds' in node.data
      ? node.data.bounds
      : null
  const dimensions =
    node.width !== undefined && node.height !== undefined
      ? { width: node.width, height: node.height }
      : parseCanvasBoundsDimensions(fallbackBounds)

  if (
    !dimensions ||
    !Number.isFinite(dimensions.width) ||
    !Number.isFinite(dimensions.height) ||
    !Number.isFinite(node.position.x) ||
    !Number.isFinite(node.position.y) ||
    dimensions.width < 0 ||
    dimensions.height < 0
  ) {
    return null
  }

  return {
    x: node.position.x,
    y: node.position.y,
    width: dimensions.width,
    height: dimensions.height,
  }
}
