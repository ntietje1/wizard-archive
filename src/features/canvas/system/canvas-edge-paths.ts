import { buildBezierCanvasEdgeGeometryFromEdge } from '../edges/bezier/bezier-canvas-edge-geometry'
import { resolveCanvasEdgeType } from '../edges/canvas-edge-registry'
import { buildStepCanvasEdgeGeometryFromEdge } from '../edges/step/step-canvas-edge-geometry'
import { buildStraightCanvasEdgeGeometryFromEdge } from '../edges/straight/straight-canvas-edge-geometry'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../types/canvas-domain-types'

export function buildCanvasEdgePath(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): string | null {
  switch (resolveCanvasEdgeType(edge.type)) {
    case 'bezier':
      return buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
    case 'straight':
      return buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
    case 'step':
      return buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
    default:
      return null
  }
}
