import getStroke from 'perfect-freehand'
import type { XYPosition } from '@xyflow/react'

export type StrokeData = {
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

export function rectFromPoints(a: XYPosition, b: XYPosition): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function pointsToPathD(
  points: Array<[number, number, number]>,
  size: number,
): string {
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
): Bounds {
  const outline = getStroke(points, { ...STROKE_OPTIONS_BASE, size })
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

export function rectIntersectsBounds(rect: Bounds, bounds: Bounds): boolean {
  return (
    rect.x < bounds.x + bounds.width &&
    rect.x + rect.width > bounds.x &&
    rect.y < bounds.y + bounds.height &&
    rect.y + rect.height > bounds.y
  )
}

export function segmentsIntersect(
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

  const bounds = getStrokeBounds(stroke.points, stroke.size)
  const trailBounds = getPolylineBounds(trail)
  if (!rectIntersectsBounds(trailBounds, bounds)) return false

  const outline = getStroke(stroke.points, {
    ...STROKE_OPTIONS_BASE,
    size: stroke.size,
  })
  if (outline.length < 2) return false

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

export function strokeInsidePolygon(
  stroke: StrokeData,
  polygon: Array<{ x: number; y: number }>,
): boolean {
  if (stroke.points.length === 0) return false
  for (const [px, py] of stroke.points) {
    if (!pointInPolygon(px, py, polygon)) return false
  }
  return true
}

export function strokeInsideRect(stroke: StrokeData, rect: Bounds): boolean {
  if (stroke.points.length === 0) return false
  for (const [px, py] of stroke.points) {
    if (
      px < rect.x ||
      px > rect.x + rect.width ||
      py < rect.y ||
      py > rect.y + rect.height
    ) {
      return false
    }
  }
  return true
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

export function pointNearStrokePath(
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
      pointToSegmentDistSq(
        px,
        py,
        outline[i][0],
        outline[i][1],
        outline[j][0],
        outline[j][1],
      ) <= thresholdSq
    ) {
      return true
    }
  }
  return false
}

export function strokePathIntersectsPolygon(
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

export function strokePathIntersectsRect(
  points: Array<[number, number, number]>,
  size: number,
  rect: Bounds,
): boolean {
  if (points.length === 0) return false
  const expanded = {
    x: rect.x - size,
    y: rect.y - size,
    width: rect.width + size * 2,
    height: rect.height + size * 2,
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
    const rectEdges: Array<[number, number, number, number]> = [
      [rect.x, rect.y, rect.x + rect.width, rect.y],
      [rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height],
      [rect.x, rect.y + rect.height, rect.x, rect.y],
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

export function getMiniMapStrokePath(
  points: Array<[number, number, number]>,
  size: number,
  zoom: number,
): string {
  return pointsToPathD(points, (size + MINI_MAP_STROKE_PADDING) / zoom)
} // Inflates stroke size in minimap to keep thin strokes visible at low zoom

export const MINI_MAP_STROKE_PADDING = 12
