import getStroke from 'perfect-freehand'
import type { Node, XYPosition } from '@xyflow/react'
import type { Point2D } from './canvas-awareness-types'
import type { StrokeNodeType } from '../components/nodes/stroke-node'

type StrokeNodeLike = {
  position: XYPosition
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

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

const STROKE_OPTIONS_BASE = {
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
}

const STROKE_SELECTION_PADDING_PX = 12
const MIN_ZOOM = 1e-6

export function rectFromPoints(a: XYPosition, b: XYPosition): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function pointsToPathD(points: Array<[number, number, number]>, size: number): string {
  const outline = getStroke(points, { ...STROKE_OPTIONS_BASE, size })
  if (outline.length < 2) return ''

  const [first, ...rest] = outline
  let d = `M ${first[0]} ${first[1]}`

  for (let i = 0; i < rest.length - 1; i++) {
    const curr = rest[i]
    const next = rest[i + 1]
    const mx = (curr[0] + next[0]) / 2
    const my = (curr[1] + next[1]) / 2
    d += ` Q ${curr[0]} ${curr[1]}, ${mx} ${my}`
  }

  const last = rest[rest.length - 1]
  d += ` L ${last[0]} ${last[1]} Z`
  return d
}

export function getStrokeBounds(
  points: Array<[number, number, number]>,
  size: number,
  precomputedOutline?: Array<Array<number>>,
): Bounds {
  const outline = precomputedOutline ?? getStroke(points, { ...STROKE_OPTIONS_BASE, size })
  if (outline.length === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const [px, py] of outline) {
    if (px < minX) minX = px
    if (py < minY) minY = py
    if (px > maxX) maxX = px
    if (py > maxY) maxY = py
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export function isStrokeNode(node: Node): node is StrokeNodeType {
  return node.type === 'stroke'
}

function getAbsoluteStrokePoints(
  points: Array<[number, number, number]>,
  bounds: Bounds,
  position: XYPosition,
): Array<[number, number, number]> {
  const offsetX = position.x - bounds.x
  const offsetY = position.y - bounds.y
  return points.map(
    ([x, y, pressure]) => [x + offsetX, y + offsetY, pressure] as [number, number, number],
  )
}

export function getAbsoluteStrokePointsForNode(node: StrokeNodeLike) {
  return getAbsoluteStrokePoints(node.data.points, node.data.bounds, node.position)
}

export function resizeStrokeNode<TNode extends StrokeNodeLike>(
  node: TNode,
  {
    width,
    height,
    position,
  }: {
    width: number
    height: number
    position: XYPosition
  },
): TNode {
  const { bounds, points, size } = node.data
  const safeBoundsWidth = Math.max(bounds.width, 1)
  const safeBoundsHeight = Math.max(bounds.height, 1)
  const scaleX = width / safeBoundsWidth
  const scaleY = height / safeBoundsHeight
  const scaledPoints = points.map(
    ([x, y, pressure]) =>
      [bounds.x + (x - bounds.x) * scaleX, bounds.y + (y - bounds.y) * scaleY, pressure] as [
        number,
        number,
        number,
      ],
  )

  return {
    ...node,
    width,
    height,
    position,
    data: {
      ...node.data,
      points: scaledPoints,
      bounds: { ...bounds, width, height },
      size: size * Math.min(scaleX, scaleY),
    },
  }
}

function rectIntersectsBounds(rect: Bounds, bounds: Bounds): boolean {
  return (
    rect.x < bounds.x + bounds.width &&
    rect.x + rect.width > bounds.x &&
    rect.y < bounds.y + bounds.height &&
    rect.y + rect.height > bounds.y
  )
}

function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
): boolean {
  const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx)
  if (Math.abs(denom) < 1e-10) return false

  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

export function polylineIntersectsStroke(
  trail: Array<{ x: number; y: number }>,
  stroke: StrokeData,
): boolean {
  if (trail.length < 2 || stroke.points.length < 2) return false

  const outline = getStroke(stroke.points, {
    ...STROKE_OPTIONS_BASE,
    size: stroke.size,
  })
  if (outline.length < 2) return false

  const bounds = getStrokeBounds(stroke.points, stroke.size, outline)

  const trailBounds = getPolylineBounds(trail)
  if (!rectIntersectsBounds(trailBounds, bounds)) return false

  const poly = outline.map(([x, y]) => ({ x, y }))
  for (const pt of trail) {
    if (pointInPolygon(pt.x, pt.y, poly)) return true
  }

  for (let i = 0; i < trail.length - 1; i++) {
    for (let j = 0; j < outline.length; j++) {
      const k = (j + 1) % outline.length
      if (
        segmentsIntersect(
          trail[i].x,
          trail[i].y,
          trail[i + 1].x,
          trail[i + 1].y,
          outline[j][0],
          outline[j][1],
          outline[k][0],
          outline[k][1],
        )
      ) {
        return true
      }
    }
  }

  return false
}

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

export function pointInPolygon(
  px: number,
  py: number,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointToSegmentDistSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    const ex = px - ax
    const ey = py - ay
    return ex * ex + ey * ey
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  const projX = ax + t * dx
  const projY = ay + t * dy
  const ex = px - projX
  const ey = py - projY
  return ex * ex + ey * ey
}

function pointNearStrokePath(
  px: number,
  py: number,
  points: Array<[number, number, number]>,
  size: number,
  threshold: number = 20,
): boolean {
  if (points.length < 2) return false
  const outline = getStroke(points, { ...STROKE_OPTIONS_BASE, size })
  if (outline.length < 3) return false

  const poly = outline.map(([x, y]) => ({ x, y }))
  if (pointInPolygon(px, py, poly)) return true

  const thresholdSq = threshold * threshold
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length
    if (
      pointToSegmentDistSq(px, py, outline[i][0], outline[i][1], outline[j][0], outline[j][1]) <=
      thresholdSq
    ) {
      return true
    }
  }
  return false
}

export function pointNearStrokeNode(
  point: Point2D,
  node: StrokeNodeLike,
  threshold: number = 20,
): boolean {
  return pointNearStrokePath(
    point.x,
    point.y,
    getAbsoluteStrokePointsForNode(node),
    node.data.size,
    threshold,
  )
}

export function getStrokeSelectionPadding(zoom: number): number {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return STROKE_SELECTION_PADDING_PX / safeZoom
}

export function pointHitsStrokeSelection(
  point: Point2D,
  node: StrokeNodeLike,
  zoom: number,
): boolean {
  return pointNearStrokeNode(point, node, getStrokeSelectionPadding(zoom))
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
  size: number,
  rect: Bounds,
): boolean {
  if (points.length === 0) return false
  const half = size / 2
  const expanded = {
    x: rect.x - half,
    y: rect.y - half,
    width: rect.width + size,
    height: rect.height + size,
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

export function strokeNodeIntersectsRect(node: StrokeNodeLike, rect: Bounds): boolean {
  return strokePathIntersectsRect(getAbsoluteStrokePointsForNode(node), node.data.size, rect)
}

export function strokeNodeIntersectsPolygon(
  node: StrokeNodeLike,
  polygon: Array<Point2D>,
): boolean {
  return strokePathIntersectsPolygon(getAbsoluteStrokePointsForNode(node), polygon)
}

const MINI_MAP_STROKE_PADDING = 12

export function getMiniMapStrokePath(
  points: Array<[number, number, number]>,
  size: number,
  zoom: number,
): string {
  const safeZoom = Number.isFinite(zoom) && zoom > MIN_ZOOM ? zoom : MIN_ZOOM
  return pointsToPathD(points, (size + MINI_MAP_STROKE_PADDING) / safeZoom)
}
