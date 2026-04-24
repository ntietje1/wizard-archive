import { boundsFromPoints, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import {
  buildPolylinePath,
  getCanvasEdgeEndpoints,
  getCanvasEdgePointThreshold,
  getPolylineMidpoint,
  pointNearPolyline,
  polylineIntersectsPolygon,
  polylineIntersectsRect,
} from '../shared/canvas-edge-geometry'
import type { PolylineCanvasEdgeGeometry } from '../shared/canvas-edge-geometry'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Edge, EdgeProps, Node } from '@xyflow/react'

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
): PolylineCanvasEdgeGeometry {
  const points = buildStraightPoints(props)
  const midpoint = getPolylineMidpoint(points)

  return {
    path: buildPolylinePath(points),
    labelX: midpoint.x,
    labelY: midpoint.y,
    points,
  }
}

export function buildStraightCanvasEdgeGeometryFromEdge(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): PolylineCanvasEdgeGeometry | null {
  const endpoints = getCanvasEdgeEndpoints(edge, nodesById)
  if (!endpoints) return null

  return buildStraightCanvasEdgeGeometryFromRenderProps(endpoints)
}

export function getStraightCanvasEdgeBounds(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): Bounds | null {
  const geometry = buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return null

  return boundsFromPoints(geometry.points)
}

export function straightCanvasEdgeContainsPoint(
  edge: Edge,
  point: Point2D,
  nodesById: ReadonlyMap<string, Node>,
  zoom: number,
): boolean {
  const geometry = buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const bounds = boundsFromPoints(geometry.points)
  const threshold = getCanvasEdgePointThreshold(zoom)
  if (
    bounds &&
    !rectIntersectsBounds(bounds, {
      x: point.x - threshold,
      y: point.y - threshold,
      width: threshold * 2,
      height: threshold * 2,
    })
  ) {
    return false
  }

  return pointNearPolyline(point, geometry.points, threshold)
}

export function straightCanvasEdgeIntersectsRectangle(
  edge: Edge,
  rect: Bounds,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const bounds = boundsFromPoints(geometry.points)
  if (bounds && !rectIntersectsBounds(bounds, rect)) {
    return false
  }

  return polylineIntersectsRect(geometry.points, rect)
}

export function straightCanvasEdgeIntersectsPolygon(
  edge: Edge,
  polygon: ReadonlyArray<Point2D>,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildStraightCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const geometryBounds = boundsFromPoints(geometry.points)
  const polygonBounds = boundsFromPoints(polygon)
  if (geometryBounds && polygonBounds && !rectIntersectsBounds(geometryBounds, polygonBounds)) {
    return false
  }

  return polylineIntersectsPolygon(geometry.points, polygon)
}
