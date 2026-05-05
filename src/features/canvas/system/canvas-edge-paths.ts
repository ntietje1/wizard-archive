import { buildCanvasEdgeGeometry } from '../edges/canvas-edge-registry'
import type { CanvasDocumentEdge, CanvasDocumentNode } from 'convex/canvases/validation'

export function buildCanvasEdgePath(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): string | null {
  return buildCanvasEdgeGeometry(edge, nodesById)?.path ?? null
}
