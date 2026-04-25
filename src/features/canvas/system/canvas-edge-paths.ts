import { buildBezierCanvasEdgeGeometryFromEdge } from '../edges/bezier/bezier-canvas-edge-geometry'
import { resolveCanvasEdgeType } from '../edges/canvas-edge-registry'
import { buildStepCanvasEdgeGeometryFromEdge } from '../edges/step/step-canvas-edge-geometry'
import { buildStraightCanvasEdgeGeometryFromEdge } from '../edges/straight/straight-canvas-edge-geometry'
import type { Edge, Node } from '@xyflow/react'

export function buildCanvasEdgePath(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): string | null {
  switch (resolveCanvasEdgeType(edge.type)) {
    case 'bezier':
      return buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
    case 'straight':
      return buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
    case 'step':
      return buildStepCanvasEdgeGeometryFromEdge(edge, nodesById)?.path ?? null
  }
}
