import { buildCanvasEdgeGeometry } from '../edges/canvas-edge-registry'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '~/features/canvas/domain/validation'

export function buildCanvasEdgePath(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): string | null {
  return buildCanvasEdgeGeometry(edge, nodesById)?.path ?? null
}
