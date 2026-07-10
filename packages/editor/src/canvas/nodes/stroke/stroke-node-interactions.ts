import type { Point2D } from '../../utils/canvas-awareness-types'
import {
  boundsFromPoints,
  pointInPolygon,
  rectIntersectsBounds,
  segmentsIntersect,
} from '../../utils/canvas-geometry-utils'
import { getAbsoluteStrokePointsForNode, getStrokeBounds } from './stroke-node-model'
import type { StrokeNodeLike } from './stroke-node-model'
import type { Bounds } from '../../utils/canvas-geometry-utils'

type StrokeData = {
  id: string
  points: Array<[number, number, number]>
  color: string
  size: number
}
type LineSegment = [number, number, number, number]

const STROKE_SELECTION_PADDING_PX = 12
const MIN_ZOOM = 1e-6

function getPolylineBounds(points: Array<{ x: number; y: number }>): Bounds {
  return boundsFromPoints(points) ?? { x: 0, y: 0, width: 0, height: 0 }
}

export function polylineIntersectsStroke(
  trail: Array<{ x: number; y: number }>,
  stroke: StrokeData,
): boolean {
  if (trail.length < 2 || stroke.points.length < 2) return false

  const distanceThreshold = stroke.size / 2
  const bounds = getStrokeBounds(stroke.points, stroke.size)
  const trailBounds = getPolylineBounds(trail)
  if (!rectIntersectsBounds(trailBounds, expandBounds(bounds, distanceThreshold))) return false

  const distanceThresholdSquared = distanceThreshold * distanceThreshold
  for (let i = 0; i < trail.length - 1; i++) {
    const trailSegment = pointPathSegmentAt(trail, i)
    for (let j = 0; j < stroke.points.length - 1; j++) {
      if (
        segmentsIntersectOrNear(
          trailSegment,
          strokePathSegmentAt(stroke.points, j),
          distanceThresholdSquared,
        )
      ) {
        return true
      }
    }
  }

  return false
}

function pointPathSegmentAt(
  points: ReadonlyArray<{ x: number; y: number }>,
  index: number,
): LineSegment {
  return [points[index].x, points[index].y, points[index + 1].x, points[index + 1].y]
}

function strokePathSegmentAt(
  points: ReadonlyArray<[number, number, number]>,
  index: number,
): LineSegment {
  return [points[index][0], points[index][1], points[index + 1][0], points[index + 1][1]]
}

function segmentsIntersectOrNear(
  first: LineSegment,
  second: LineSegment,
  thresholdSquared: number,
): boolean {
  return (
    segmentsIntersect(...first, ...second) ||
    getSegmentDistanceSquared(...first, ...second) <= thresholdSquared
  )
}

export function getStrokeSelectionPadding(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return STROKE_SELECTION_PADDING_PX / safeZoom
}

export function getStrokeHighlightPathSize(strokeSize: number, zoom: number): number {
  return strokeSize + getStrokeSelectionPadding(zoom)
}

export function getStrokeSelectionBounds(node: StrokeNodeLike, zoom: number): Bounds {
  const threshold = getStrokeSelectionPadding(zoom)
  const bounds = node.data.bounds

  return {
    x: node.position.x - threshold,
    y: node.position.y - threshold,
    width: bounds.width + threshold * 2,
    height: bounds.height + threshold * 2,
  }
}

function strokePathIntersectsPolygon(
  points: Array<[number, number, number]>,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  threshold = 0,
): boolean {
  const polygonBounds = boundsFromPoints(polygon)
  const pathBounds = boundsFromPoints(points.map(([x, y]) => ({ x, y }))) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }
  if (polygonBounds && !rectIntersectsBounds(expandBounds(pathBounds, threshold), polygonBounds)) {
    return false
  }

  return (
    hasStrokePointInsidePolygon(points, polygon) ||
    strokePathIntersectsPolygonEdges(points, polygon, threshold)
  )
}

function hasStrokePointInsidePolygon(
  points: ReadonlyArray<[number, number, number]>,
  polygon: ReadonlyArray<{ x: number; y: number }>,
): boolean {
  return points.some(([px, py]) => pointInPolygon(px, py, polygon))
}

function strokePathIntersectsPolygonEdges(
  points: ReadonlyArray<[number, number, number]>,
  polygon: ReadonlyArray<{ x: number; y: number }>,
  threshold: number,
): boolean {
  if (points.length < 2 || polygon.length < 2) {
    return false
  }

  const thresholdSquared = threshold * threshold
  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length
    if (strokePathIntersectsPolygonEdge(points, polygon[i], polygon[j], thresholdSquared)) {
      return true
    }
  }
  return false
}

function strokePathIntersectsPolygonEdge(
  points: ReadonlyArray<[number, number, number]>,
  edgeStart: { x: number; y: number },
  edgeEnd: { x: number; y: number },
  thresholdSquared: number,
): boolean {
  for (let i = 0; i < points.length - 1; i++) {
    const distanceSquared = getSegmentDistanceSquared(
      edgeStart.x,
      edgeStart.y,
      edgeEnd.x,
      edgeEnd.y,
      points[i][0],
      points[i][1],
      points[i + 1][0],
      points[i + 1][1],
    )
    if (distanceSquared <= thresholdSquared) {
      return true
    }
  }
  return false
}
function expandBounds(bounds: Bounds, amount: number): Bounds {
  return {
    x: bounds.x - amount,
    y: bounds.y - amount,
    width: bounds.width + amount * 2,
    height: bounds.height + amount * 2,
  }
}

function getSegmentDistanceSquared(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): number {
  if (segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) {
    return 0
  }

  return Math.min(
    getPointToSegmentDistanceSquared(ax, ay, cx, cy, dx, dy),
    getPointToSegmentDistanceSquared(bx, by, cx, cy, dx, dy),
    getPointToSegmentDistanceSquared(cx, cy, ax, ay, bx, by),
    getPointToSegmentDistanceSquared(dx, dy, ax, ay, bx, by),
  )
}

function getPointToSegmentDistanceSquared(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) {
    return getDistanceSquared(px, py, ax, ay)
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return getDistanceSquared(px, py, ax + t * dx, ay + t * dy)
}

function getDistanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function strokePathIntersectsRect(
  points: Array<[number, number, number]>,
  threshold: number,
  rect: Bounds,
): boolean {
  if (points.length === 0) return false
  const expanded = {
    x: rect.x - threshold,
    y: rect.y - threshold,
    width: rect.width + threshold * 2,
    height: rect.height + threshold * 2,
  }
  for (const [px, py] of points) {
    if (
      px >= expanded.x &&
      px <= expanded.x + expanded.width &&
      py >= expanded.y &&
      py <= expanded.y + expanded.height
    ) {
      return true
    }
  }
  if (points.length >= 2) {
    const ex = expanded.x
    const ey = expanded.y
    const ew = expanded.width
    const eh = expanded.height
    const rectEdges: Array<[number, number, number, number]> = [
      [ex, ey, ex + ew, ey],
      [ex + ew, ey, ex + ew, ey + eh],
      [ex + ew, ey + eh, ex, ey + eh],
      [ex, ey + eh, ex, ey],
    ]
    for (const [ex1, ey1, ex2, ey2] of rectEdges) {
      for (let i = 0; i < points.length - 1; i++) {
        if (
          segmentsIntersect(
            ex1,
            ey1,
            ex2,
            ey2,
            points[i][0],
            points[i][1],
            points[i + 1][0],
            points[i + 1][1],
          )
        ) {
          return true
        }
      }
    }
  }
  return false
}

export function strokeNodeIntersectsRect(
  node: StrokeNodeLike,
  rect: Bounds,
  zoom: number,
): boolean {
  return strokePathIntersectsRect(
    getAbsoluteStrokePointsForNode(node),
    Math.max(node.data.size / 2, getStrokeSelectionPadding(zoom)),
    rect,
  )
}

export function strokeNodeIntersectsPolygon(
  node: StrokeNodeLike,
  polygon: ReadonlyArray<Point2D>,
  zoom: number,
): boolean {
  return strokePathIntersectsPolygon(
    getAbsoluteStrokePointsForNode(node),
    polygon,
    Math.max(node.data.size / 2, getStrokeSelectionPadding(zoom)),
  )
}
