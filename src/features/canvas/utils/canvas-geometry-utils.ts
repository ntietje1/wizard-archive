import type { XYPosition } from '@xyflow/react'

export type Bounds = {
  x: number
  y: number
  width: number
  height: number
}

export type PointLike = XYPosition

export function rectFromPoints(a: XYPosition, b: XYPosition): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export function rectIntersectsBounds(rect: Bounds, bounds: Bounds): boolean {
  return (
    rect.x < bounds.x + bounds.width &&
    rect.x + rect.width > bounds.x &&
    rect.y < bounds.y + bounds.height &&
    rect.y + rect.height > bounds.y
  )
}

export function boundsFromPoints(points: ReadonlyArray<PointLike>): Bounds | null {
  if (points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
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

export function pointInPolygon(
  px: number,
  py: number,
  polygon: ReadonlyArray<{ x: number; y: number }>,
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

export function polygonIntersectsBounds(
  polygon: ReadonlyArray<{ x: number; y: number }>,
  bounds: Bounds,
): boolean {
  const polygonBounds = boundsFromPoints(polygon)
  if (polygonBounds && !rectIntersectsBounds(polygonBounds, bounds)) {
    return false
  }

  const corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ]

  if (corners.some((corner) => pointInPolygon(corner.x, corner.y, polygon))) {
    return true
  }

  if (
    polygon.some(
      (point) =>
        point.x >= bounds.x &&
        point.x <= bounds.x + bounds.width &&
        point.y >= bounds.y &&
        point.y <= bounds.y + bounds.height,
    )
  ) {
    return true
  }

  const boundsEdges: Array<[number, number, number, number]> = [
    [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y],
    [bounds.x + bounds.width, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height],
    [bounds.x + bounds.width, bounds.y + bounds.height, bounds.x, bounds.y + bounds.height],
    [bounds.x, bounds.y + bounds.height, bounds.x, bounds.y],
  ]

  for (let polygonIndex = 0; polygonIndex < polygon.length; polygonIndex += 1) {
    const nextPolygonIndex = (polygonIndex + 1) % polygon.length
    for (const [ax, ay, bx, by] of boundsEdges) {
      if (
        segmentsIntersect(
          polygon[polygonIndex].x,
          polygon[polygonIndex].y,
          polygon[nextPolygonIndex].x,
          polygon[nextPolygonIndex].y,
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

export function pointToSegmentDistSq(
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
  if (lenSq < 1e-10) {
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
