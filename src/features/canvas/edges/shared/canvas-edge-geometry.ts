import { normalizeCanvasNode } from '../../nodes/canvas-node-normalization'
import { getCanvasNodeBounds } from '../../nodes/shared/canvas-node-bounds'
import {
  getAbsoluteStrokePointsForNode,
  getStrokeEndpointConnectionPosition,
  getStrokeEndpointPoint,
} from '../../nodes/stroke/stroke-node-model'
import {
  boundsFromPoints,
  pointInPolygon,
  pointToSegmentDistSq,
  rectIntersectsBounds,
  segmentsIntersect,
} from '../../utils/canvas-geometry-utils'
import { Position } from '@xyflow/react'
import type { Point2D } from '../../utils/canvas-awareness-types'
import type { Bounds } from '../../utils/canvas-geometry-utils'
import type { Edge, Node } from '@xyflow/react'

const DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH = 20
const MIN_ZOOM = 1e-6
const NODE_EDGE_ANCHOR_OUTSET_PX = 0
const POINT_EPSILON = 1e-6

type CanvasEdgeEndpoints = {
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
}

export type PolylineCanvasEdgeGeometry = {
  path: string
  labelX: number
  labelY: number
  points: Array<Point2D>
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

export function resolveCanvasEdgeEndpoint(
  node: Node,
  handleId: string | null | undefined,
  fallbackPosition: Position,
): { point: Point2D; position: Position } | null {
  const parsedNode = normalizeCanvasNode(node)

  if (parsedNode?.type === 'stroke' && (handleId === 'start' || handleId === 'end')) {
    const absolutePoints = getAbsoluteStrokePointsForNode(parsedNode)
    const point = getStrokeEndpointPoint(parsedNode, handleId, absolutePoints)
    if (!point) {
      return null
    }

    return {
      point,
      position: getStrokeEndpointConnectionPosition(parsedNode, handleId, absolutePoints),
    }
  }

  const position = handleIdToPosition(handleId, fallbackPosition)
  const point = getCanvasEdgeAnchorPoint(node, position)
  if (!point) {
    return null
  }

  return { point, position }
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

function inferCanvasEdgePositions(sourceNode: Node, targetNode: Node) {
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

function getCanvasEdgeAnchorPoint(node: Node, position: Position): Point2D | null {
  const bounds = getCanvasNodeBounds(node)
  if (!bounds) return null

  switch (position) {
    case Position.Top:
      return { x: bounds.x + bounds.width / 2, y: bounds.y - NODE_EDGE_ANCHOR_OUTSET_PX }
    case Position.Right:
      return {
        x: bounds.x + bounds.width + NODE_EDGE_ANCHOR_OUTSET_PX,
        y: bounds.y + bounds.height / 2,
      }
    case Position.Bottom:
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height + NODE_EDGE_ANCHOR_OUTSET_PX,
      }
    case Position.Left:
      return { x: bounds.x - NODE_EDGE_ANCHOR_OUTSET_PX, y: bounds.y + bounds.height / 2 }
    default:
      return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
  }
}

export function getCanvasEdgeInteractionWidth(): number {
  return DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH
}

export function getCanvasEdgePointThreshold(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return DEFAULT_CANVAS_EDGE_INTERACTION_WIDTH / 2 / safeZoom
}

export function getCanvasEdgeEndpoints(
  edge: Edge,
  nodesById: ReadonlyMap<string, Node>,
): CanvasEdgeEndpoints | null {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  if (!sourceNode || !targetNode) return null

  const inferredPositions = inferCanvasEdgePositions(sourceNode, targetNode)
  const sourceEndpoint = resolveCanvasEdgeEndpoint(
    sourceNode,
    edge.sourceHandle,
    inferredPositions.sourcePosition,
  )
  const targetEndpoint = resolveCanvasEdgeEndpoint(
    targetNode,
    edge.targetHandle,
    inferredPositions.targetPosition,
  )
  if (!sourceEndpoint || !targetEndpoint) return null

  return {
    sourceX: sourceEndpoint.point.x,
    sourceY: sourceEndpoint.point.y,
    targetX: targetEndpoint.point.x,
    targetY: targetEndpoint.point.y,
    sourcePosition: sourceEndpoint.position,
    targetPosition: targetEndpoint.position,
  }
}

export function compactPolylinePoints(points: ReadonlyArray<Point2D>): Array<Point2D> {
  return points.filter((point, index) => {
    if (index === 0) return true

    const previous = points[index - 1]
    return (
      Math.abs(previous.x - point.x) > POINT_EPSILON ||
      Math.abs(previous.y - point.y) > POINT_EPSILON
    )
  })
}

export function buildPolylinePath(points: ReadonlyArray<Point2D>): string {
  if (points.length === 0) return ''

  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x},${point.y}`).join(' ')
}

export function getPolylineMidpoint(points: ReadonlyArray<Point2D>): Point2D {
  if (points.length === 0) {
    return { x: 0, y: 0 }
  }

  let totalLength = 0
  const segmentLengths: Array<number> = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const dx = points[index + 1].x - points[index].x
    const dy = points[index + 1].y - points[index].y
    const segmentLength = Math.hypot(dx, dy)
    segmentLengths.push(segmentLength)
    totalLength += segmentLength
  }

  if (totalLength <= POINT_EPSILON) {
    return points[0]
  }

  const midpointDistance = totalLength / 2
  let traversedLength = 0

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index]
    if (traversedLength + segmentLength >= midpointDistance) {
      if (segmentLength <= POINT_EPSILON) {
        return points[index + 1]
      }

      const ratio = (midpointDistance - traversedLength) / segmentLength
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio,
      }
    }

    traversedLength += segmentLength
  }

  return points[points.length - 1]
}

export function pointNearPolyline(
  point: Point2D,
  polyline: ReadonlyArray<Point2D>,
  threshold: number,
): boolean {
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

function pointInRect(point: Point2D, rect: Bounds): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

export function polylineIntersectsRect(points: ReadonlyArray<Point2D>, rect: Bounds): boolean {
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

export function polylineIntersectsPolygon(
  points: ReadonlyArray<Point2D>,
  polygon: ReadonlyArray<Point2D>,
): boolean {
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
