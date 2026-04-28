import { boundsFromPoints, rectIntersectsBounds } from '../../utils/canvas-geometry-utils'
import {
  getCanvasEdgeEndpoints,
  getCanvasEdgePointThreshold,
  pointNearPolyline,
  polylineIntersectsPolygon,
  polylineIntersectsRect,
} from '../shared/canvas-edge-geometry'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type {
  CanvasDocumentEdge,
  CanvasHandlePosition,
  CanvasDocumentNode,
} from '~/features/canvas/types/canvas-domain-types'
import { CANVAS_HANDLE_POSITION } from '~/features/canvas/types/canvas-domain-types'
import type { CanvasEdgeRenderGeometryProps as EdgeProps } from '../canvas-edge-types'
import { assertNever } from '~/shared/utils/utils'

const DEFAULT_BEZIER_SAMPLE_STEPS = 24
const DEFAULT_CURVATURE = 0.25

type BezierCurve = {
  path: string
  labelX: number
  labelY: number
  start: Point2D
  control1: Point2D
  control2: Point2D
  end: Point2D
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

function getControlOffset(distance: number, curvature: number): number {
  return distance >= 0 ? distance / 2 : curvature * 25 * Math.sqrt(-distance)
}

function getControlPoint({
  curvature,
  position,
  source,
  target,
}: {
  curvature: number
  position: CanvasHandlePosition
  source: Point2D
  target: Point2D
}): Point2D {
  switch (position) {
    case CANVAS_HANDLE_POSITION.Left:
      return {
        x: source.x - getControlOffset(source.x - target.x, curvature),
        y: source.y,
      }
    case CANVAS_HANDLE_POSITION.Right:
      return {
        x: source.x + getControlOffset(target.x - source.x, curvature),
        y: source.y,
      }
    case CANVAS_HANDLE_POSITION.Top:
      return {
        x: source.x,
        y: source.y - getControlOffset(source.y - target.y, curvature),
      }
    case CANVAS_HANDLE_POSITION.Bottom:
      return {
        x: source.x,
        y: source.y + getControlOffset(target.y - source.y, curvature),
      }
    default:
      return assertNever(position)
  }
}

function buildBezierPath(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
) {
  const source = { x: props.sourceX, y: props.sourceY }
  const target = { x: props.targetX, y: props.targetY }
  const control1 = getControlPoint({
    curvature: DEFAULT_CURVATURE,
    position: props.sourcePosition,
    source,
    target,
  })
  const control2 = getControlPoint({
    curvature: DEFAULT_CURVATURE,
    position: props.targetPosition,
    source: target,
    target: source,
  })
  const curve = {
    path: `M ${source.x},${source.y} C ${control1.x},${control1.y} ${control2.x},${control2.y} ${target.x},${target.y}`,
    labelX: 0,
    labelY: 0,
    start: source,
    control1,
    control2,
    end: target,
  }
  const label = evaluateBezierPoint(curve, 0.5)

  return {
    ...curve,
    labelX: label.x,
    labelY: label.y,
  }
}

export function buildBezierCanvasEdgeGeometryFromRenderProps(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
): BezierCurve {
  return buildBezierPath(props)
}

export function buildBezierCanvasEdgeGeometryFromEdge(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): BezierCurve | null {
  const endpoints = getCanvasEdgeEndpoints(edge, nodesById)
  if (!endpoints) return null

  return buildBezierCanvasEdgeGeometryFromRenderProps(endpoints)
}

export function getBezierCanvasEdgeBounds(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): Bounds | null {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return null

  return boundsFromPoints(sampleBezierCurve(geometry))
}

export function bezierCanvasEdgeContainsPoint(
  edge: CanvasDocumentEdge,
  point: Point2D,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
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
  edge: CanvasDocumentEdge,
  rect: Bounds,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
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
  edge: CanvasDocumentEdge,
  polygon: ReadonlyArray<Point2D>,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometryFromEdge(edge, nodesById)
  if (!geometry) return false

  return polylineIntersectsPolygon(sampleBezierCurve(geometry), polygon)
}
