import { buildCanvasEdgeGeometryFromResolvedEndpoints } from '../shared/canvas-edge-geometry'
import type { CanvasEdgeGeometry } from '../shared/canvas-edge-geometry'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { CanvasHandlePosition } from '../../types/canvas-domain-types'
import { CANVAS_HANDLE_POSITION } from '../../types/canvas-domain-types'
import type { CanvasEdgeRenderGeometryProps as EdgeProps } from '../canvas-edge-types'
import type { CanvasDocumentEdge, CanvasDocumentNode } from '../../document-contract'

const MIN_BEZIER_SAMPLE_STEPS = 24
const MAX_BEZIER_SAMPLE_STEPS = 160
const BEZIER_SAMPLE_SEGMENT_LENGTH = 32
const DEFAULT_CURVATURE = 0.25

function assertNever(value: never): never {
  throw new Error(`Unhandled canvas handle position: ${JSON.stringify(value)}`)
}

type BezierCurve = {
  path: string
  labelX: number
  labelY: number
  start: Point2D
  control1: Point2D
  control2: Point2D
  end: Point2D
  hitPoints: ReadonlyArray<Point2D>
}

type BezierCurveWithoutSamples = Omit<BezierCurve, 'hitPoints'>

function evaluateBezierPoint(curve: BezierCurveWithoutSamples, t: number): Point2D {
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

function getPointDistance(left: Point2D, right: Point2D): number {
  return Math.hypot(right.x - left.x, right.y - left.y)
}

function getBezierSampleSteps(curve: BezierCurveWithoutSamples): number {
  const controlPolygonLength =
    getPointDistance(curve.start, curve.control1) +
    getPointDistance(curve.control1, curve.control2) +
    getPointDistance(curve.control2, curve.end)

  return Math.min(
    MAX_BEZIER_SAMPLE_STEPS,
    Math.max(
      MIN_BEZIER_SAMPLE_STEPS,
      Math.ceil(controlPolygonLength / BEZIER_SAMPLE_SEGMENT_LENGTH),
    ),
  )
}

function sampleBezierCurve(curve: BezierCurveWithoutSamples) {
  const steps = getBezierSampleSteps(curve)
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
  const curve: BezierCurveWithoutSamples = {
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
    hitPoints: sampleBezierCurve(curve),
  }
}

export function buildBezierCanvasEdgeGeometryFromRenderProps(
  props: Pick<
    EdgeProps,
    'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'
  >,
): CanvasEdgeGeometry {
  return buildBezierPath(props)
}

export function buildBezierCanvasEdgeGeometryFromEdge(
  edge: CanvasDocumentEdge,
  nodesById: ReadonlyMap<string, CanvasDocumentNode>,
): CanvasEdgeGeometry | null {
  return buildCanvasEdgeGeometryFromResolvedEndpoints(edge, nodesById, (endpoints) =>
    buildBezierCanvasEdgeGeometryFromRenderProps(endpoints),
  )
}
