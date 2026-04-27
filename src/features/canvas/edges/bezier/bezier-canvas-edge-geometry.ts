import { boundsFromPoints, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import {
  getCanvasEdgeEndpoints,
  getCanvasEdgePointThreshold,
  pointNearPolyline,
  polylineIntersectsPolygon,
  polylineIntersectsRect,
} from '../shared/canvas-edge-geometry'
import { getBezierPath } from '@xyflow/react'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Edge, EdgeProps, Node } from '@xyflow/react'

const DEFAULT_BEZIER_SAMPLE_STEPS = 24

type BezierCurve = {
  path: string
  labelX: number
  labelY: number
  start: Point2D
  control1: Point2D
  control2: Point2D
  end: Point2D
}

function parseBezierPath(path: string, labelX: number, labelY: number): BezierCurve | null {
  const match = path
    .trim()
    .match(
      /^M\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,?\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*C\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,?\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,?\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,?\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)$/i,
    )
  if (!match) return null

  const values = match.slice(1).map(Number)
  if (values.some((value) => !Number.isFinite(value))) return null

  return {
    path,
    labelX,
    labelY,
    start: { x: values[0], y: values[1] },
    control1: { x: values[2], y: values[3] },
    control2: { x: values[4], y: values[5] },
    end: { x: values[6], y: values[7] },
  }
}

function evaluateBezierPoint(curve: BezierCurve, t: number): Point2D {
  const mt = 1 - t
  const mt2 = mt * mt
  const t2 = t * t

  return {
    x:
      mt2 * mt * curve.start.x +
      3 * mt2 * t * curve.control1.x +
      3 * mt * t2 * curve.control2.x +
      t2 * t * curve.end.x,
    y:
      mt2 * mt * curve.start.y +
      3 * mt2 * t * curve.control1.y +
      3 * mt * t2 * curve.control2.y +
      t2 * t * curve.end.y,
  }
}

function sampleBezierCurve(curve: BezierCurve, steps: number = DEFAULT_BEZIER_SAMPLE_STEPS) {
  const points: Array<Point2D> = []

  for (let index = 0; index <= steps; index += 1) {
    points.push(evaluateBezierPoint(curve, index / steps))
  }

  return points
}

export function buildBezierCanvasEdgeGeometryFromRenderProps(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
): BezierCurve | null {
  const [path, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  })

  return parseBezierPath(path, labelX, labelY)
}

export function buildBezierCanvasEdgeGeometryFromEdge(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): BezierCurve | null {
  const endpoints = getCanvasEdgeEndpoints(edge, nodesById)
  if (!endpoints) return null

  return buildBezierCanvasEdgeGeometryFromRenderProps(endpoints)
}

export function getBezierCanvasEdgeBounds(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): Bounds | null {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return null

  return boundsFromPoints(sampleBezierCurve(geometry))
}

export function bezierCanvasEdgeContainsPoint(
  edge: Edge,
  point: Point2D,
  nodesById: ReadonlyMap<string, Node>,
  zoom: number,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const sampledCurve = sampleBezierCurve(geometry)
  const bounds = boundsFromPoints(sampledCurve)
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

  return pointNearPolyline(point, sampledCurve, threshold)
}

export function bezierCanvasEdgeIntersectsRectangle(
  edge: Edge,
  rect: Bounds,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  const points = sampleBezierCurve(geometry)
  const bounds = boundsFromPoints(points)
  if (bounds && !rectIntersectsBounds(bounds, rect)) {
    return false
  }

  return polylineIntersectsRect(points, rect)
}

export function bezierCanvasEdgeIntersectsPolygon(
  edge: Edge,
  polygon: ReadonlyArray<Point2D>,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  return polylineIntersectsPolygon(sampleBezierCurve(geometry), polygon)
}
