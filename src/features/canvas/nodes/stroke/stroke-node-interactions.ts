import type { Point2D } from '../../utils/canvas-awareness-types'
import {
  pointInPolygon,
  pointToSegmentDistSq,
  rectIntersectsBounds,
  segmentsIntersect,
} from '../../utils/canvas-geometry-utils'
import { getAbsoluteStrokePointsForNode, getStrokeBounds } from './stroke-node-model'
import type { Bounds } from '../../utils/canvas-geometry-utils'

type StrokeNodeLike = {
  position: { x: number; y: number }
  data: {
    points: Array<[number, number, number]>
    size: number
    bounds: Bounds
  }
}

type StrokeData = {
  id: string
  points: Array<[number, number, number]>
  color: string
  size: number
}

const STROKE_SELECTION_PADDING_PX = 12
const MIN_ZOOM = 1e-6

function getPolylineBounds(points: Array<{ x: number; y: number }>): Bounds {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function polylineIntersectsStroke(
  trail: Array<{ x: number; y: number }>,
  stroke: StrokeData,
): boolean {
  if (trail.length < 2 || stroke.points.length < 2) return false

  const bounds = getStrokeBounds(stroke.points, stroke.size)
  const trailBounds = getPolylineBounds(trail)
  if (!rectIntersectsBounds(trailBounds, bounds)) return false

  const poly = stroke.points.map(([x, y]) => ({ x, y }))
  for (const pt of trail) {
    if (pointInPolygon(pt.x, pt.y, poly)) return true
  }

  for (let i = 0; i < trail.length - 1; i++) {
    for (let j = 0; j < stroke.points.length - 1; j++) {
      if (
        segmentsIntersect(
          trail[i].x,
          trail[i].y,
          trail[i + 1].x,
          trail[i + 1].y,
          stroke.points[j][0],
          stroke.points[j][1],
          stroke.points[j + 1][0],
          stroke.points[j + 1][1],
        )
      ) {
        return true
      }
    }
  }

  return false
}

function pointNearStrokePath(
  px: number,
  py: number,
  points: Array<[number, number, number]>,
  threshold: number = 20,
): boolean {
  if (points.length < 2) return false

  const thresholdSq = threshold * threshold
  for (let i = 0; i < points.length - 1; i++) {
    if (
      pointToSegmentDistSq(
        px,
        py,
        points[i][0],
        points[i][1],
        points[i + 1][0],
        points[i + 1][1],
      ) <= thresholdSq
    ) {
      return true
    }
  }
  return false
}

export function getStrokeSelectionPadding(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return STROKE_SELECTION_PADDING_PX / safeZoom
}

function pointHitsStrokeSelection(point: Point2D, node: StrokeNodeLike, zoom: number): boolean {
  return pointNearStrokePath(
    point.x,
    point.y,
    getAbsoluteStrokePointsForNode(node),
    getStrokeSelectionPadding(zoom),
  )
}

export function strokeNodeContainsPoint(
  node: StrokeNodeLike,
  point: Point2D,
  zoom: number,
): boolean {
  const bounds = strokeNodePointBounds(node, zoom)
  if (
    point.x < bounds.x ||
    point.x > bounds.x + bounds.width ||
    point.y < bounds.y ||
    point.y > bounds.y + bounds.height
  ) {
    return false
  }

  return pointHitsStrokeSelection(point, node, zoom)
}

function strokePathIntersectsPolygon(
  points: Array<[number, number, number]>,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  for (const [px, py] of points) {
    if (pointInPolygon(px, py, polygon)) return true
  }
  if (points.length >= 2 && polygon.length >= 2) {
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length
      for (let k = 0; k < points.length - 1; k++) {
        if (
          segmentsIntersect(
            polygon[i].x,
            polygon[i].y,
            polygon[j].x,
            polygon[j].y,
            points[k][0],
            points[k][1],
            points[k + 1][0],
            points[k + 1][1],
          )
        ) {
          return true
        }
      }
    }
  }
  return false
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
  polygon: Array<Point2D>,
): boolean {
  return strokePathIntersectsPolygon(getAbsoluteStrokePointsForNode(node), polygon)
}

function strokeNodePointBounds(node: StrokeNodeLike, zoom: number): Bounds {
  const threshold = getStrokeSelectionPadding(zoom)
  const bounds = node.data.bounds

  return {
    x: node.position.x - threshold,
    y: node.position.y - threshold,
    width: bounds.width + threshold * 2,
    height: bounds.height + threshold * 2,
  }
}
