import {
  buildCanvasEdgeGeometryFromResolvedEndpoints,
  buildPolylinePath,
  getPolylineMidpoint,
} from '../shared/canvas-edge-geometry'
import type { CanvasEdgeGeometry } from '../shared/canvas-edge-geometry'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { CanvasEdgeRenderGeometryProps as EdgeProps } from '../canvas-edge-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

function buildStraightPoints(
  props: Pick<EdgeProps, 'sourceX' | 'sourceY' | 'targetX' | 'targetY'>,
): Array<Point2D> {
  return [
    { x: props.sourceX, y: props.sourceY },
    { x: props.targetX, y: props.targetY },
  ]
}

export function buildStraightCanvasEdgeGeometryFromRenderProps(
  props: Pick<EdgeProps, 'sourceX' | 'sourceY' | 'targetX' | 'targetY'>,
): CanvasEdgeGeometry {
  const points = buildStraightPoints(props)
  const midpoint = getPolylineMidpoint(points)

  return {
    path: buildPolylinePath(points),
    labelX: midpoint.x,
    labelY: midpoint.y,
    hitPoints: points,
  }
}

export function buildStraightCanvasEdgeGeometryFromEdge(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): CanvasEdgeGeometry | null {
  return buildCanvasEdgeGeometryFromResolvedEndpoints(edge, nodesById, (endpoints) =>
    buildStraightCanvasEdgeGeometryFromRenderProps(endpoints),
  )
}
