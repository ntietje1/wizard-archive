import { rectFromPoints } from './canvas-geometry-utils'
import type { Bounds, PointLike } from './canvas-geometry-utils'

export function constrainPointToAxis(start: PointLike, end: PointLike): PointLike {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return { x: end.x, y: start.y }
  }

  return { x: start.x, y: end.y }
}

export function constrainPointToSquare(start: PointLike, end: PointLike): PointLike {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y
  const size = Math.min(Math.abs(deltaX), Math.abs(deltaY))

  return {
    x: start.x + Math.sign(deltaX || 1) * size,
    y: start.y + Math.sign(deltaY || 1) * size,
  }
}

export function getConstrainedRectFromPoints(
  start: PointLike,
  end: PointLike,
  { square }: { square: boolean },
): Bounds {
  return rectFromPoints(start, square ? constrainPointToSquare(start, end) : end)
}
