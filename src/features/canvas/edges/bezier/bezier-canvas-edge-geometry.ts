import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-selection'
import {
  boundsFromPoints,
  pointInPolygon,
  pointToSegmentDistSq,
  rectIntersectsBounds,
  segmentsIntersect,
} from '../../utils/canvas-geometry-utils'
import { getBezierPath, Position } from '@xyflow/react'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Edge, EdgeProps, Node } from '@xyflow/react'

const DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH = 20
const MIN_ZOOM = 1e-6
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

type EdgeEndpoints = {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
}

function handleIdToPosition(handleId: string | null | undefined, fallback: Position): Position {
  switch (handleId) {
    case 'top':
      return Position.Top
    case 'right':
      return Position.Right
    case 'bottom':
      return Position.Bottom
    case 'left':
      return Position.Left
    default:
      return fallback
  }
}

function getBoundsCenter(node: Node) {
  const bounds = getCanvasNodeBounds(node)
  if (!bounds) return null

  return {
    bounds,
    center: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    },
  }
}

function inferEdgePositions(sourceNode: Node, targetNode: Node) {
  const source = getBoundsCenter(sourceNode)
  const target = getBoundsCenter(targetNode)
  if (!source || !target) {
    return { sourcePosition: Position.Right, targetPosition: Position.Left }
  }

  const dx = target.center.x - source.center.x
  const dy = target.center.y - source.center.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { sourcePosition: Position.Right, targetPosition: Position.Left }
      : { sourcePosition: Position.Left, targetPosition: Position.Right }
  }

  return dy >= 0
    ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
    : { sourcePosition: Position.Top, targetPosition: Position.Bottom }
}

function getNodeAnchorPoint(node: Node, position: Position): Point2D | null {
  const bounds = getCanvasNodeBounds(node)
  if (!bounds) return null

  switch (position) {
    case Position.Top:
      return { x: bounds.x + bounds.width / 2, y: bounds.y }
    case Position.Right:
      return { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }
    case Position.Bottom:
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }
    case Position.Left:
      return { x: bounds.x, y: bounds.y + bounds.height / 2 }
    default:
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }
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

function pointInRect(point: Point2D, rect: Bounds): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

function polylineIntersectsRect(points: Array<Point2D>, rect: Bounds): boolean {
  if (points.some((point) => pointInRect(point, rect))) {
    return true
  }

  const rectEdges: Array<[number, number, number, number]> = [
    [rect.x, rect.y, rect.x + rect.width, rect.y],
    [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
    [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
    [rect.x, rect.y + rect.height, rect.x, rect.y],
  ]

  for (let index = 0; index < points.length - 1; index += 1) {
    for (const [ax, ay, bx, by] of rectEdges) {
      if (
        segmentsIntersect(
          points[index].x,
          points[index].y,
          points[index + 1].x,
          points[index + 1].y,
          ax,
          ay,
          bx,
          by,
        )
      ) {
        return true
      }
    }
  }

  return false
}

function polylineIntersectsPolygon(points: Array<Point2D>, polygon: Array<Point2D>): boolean {
  const polygonBounds = boundsFromPoints(polygon)
  const polylineBounds = boundsFromPoints(points)
  if (polygonBounds && polylineBounds && !rectIntersectsBounds(polylineBounds, polygonBounds)) {
    return false
  }

  if (points.some((point) => pointInPolygon(point.x, point.y, polygon))) {
    return true
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
      const nextPolygonIndex = (polygonIndex + 1) % polygon.length
      if (
        segmentsIntersect(
          points[index].x,
          points[index].y,
          points[index + 1].x,
          points[index + 1].y,
          polygon[polygonIndex].x,
          polygon[polygonIndex].y,
          polygon[nextPolygonIndex].x,
          polygon[nextPolygonIndex].y,
        )
      ) {
        return true
      }
    }
  }

  return false
}

function pointNearPolyline(point: Point2D, polyline: Array<Point2D>, threshold: number): boolean {
  const thresholdSq = threshold * threshold

  for (let index = 0; index < polyline.length - 1; index += 1) {
    if (
      pointToSegmentDistSq(
        point.x,
        point.y,
        polyline[index].x,
        polyline[index].y,
        polyline[index + 1].x,
        polyline[index + 1].y,
      ) <= thresholdSq
    ) {
      return true
    }
  }

  return false
}

export function getBezierCanvasEdgeInteractionWidth(): number {
  return DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH
}

function getBezierCanvasEdgePointThreshold(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH / 2 / safeZoom
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

function getBezierCanvasEdgeEndpoints(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): EdgeEndpoints | null {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  if (!sourceNode || !targetNode) return null

  const inferredPositions = inferEdgePositions(sourceNode, targetNode)
  const sourcePosition = handleIdToPosition(edge.sourceHandle, inferredPositions.sourcePosition)
  const targetPosition = handleIdToPosition(edge.targetHandle, inferredPositions.targetPosition)
  const source = getNodeAnchorPoint(sourceNode, sourcePosition)
  const target = getNodeAnchorPoint(targetNode, targetPosition)
  if (!source || !target) return null

  return {
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
    sourcePosition,
    targetPosition,
  }
}

function buildBezierCanvasEdgeGeometry(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): BezierCurve | null {
  const endpoints = getBezierCanvasEdgeEndpoints(edge, nodesById)
  if (!endpoints) return null

  return buildBezierCanvasEdgeGeometryFromRenderProps(endpoints)
}

export function getBezierCanvasEdgeBounds(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): Bounds | null {
  const geometry = buildBezierCanvasEdgeGeometry(edge, nodesById)
  if (!geometry) return null

  return boundsFromPoints(sampleBezierCurve(geometry))
}

export function bezierCanvasEdgeContainsPoint(
  edge: Edge,
  point: Point2D,
  nodesById: ReadonlyMap<string, Node>,
  zoom: number,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometry(edge, nodesById)
  if (!geometry) return false

  const sampledCurve = sampleBezierCurve(geometry)
  const bounds = boundsFromPoints(sampledCurve)
  const threshold = getBezierCanvasEdgePointThreshold(zoom)

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
  const geometry = buildBezierCanvasEdgeGeometry(edge, nodesById)
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
  polygon: Array<Point2D>,
  nodesById: ReadonlyMap<string, Node>,
): boolean {
  const geometry = buildBezierCanvasEdgeGeometry(edge, nodesById)
  if (!geometry) return false

  return polylineIntersectsPolygon(sampleBezierCurve(geometry), polygon)
}
