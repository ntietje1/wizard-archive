import type { CanvasBounds } from './canvas-bounds'
import { canvasBoundsFromPoints } from './selection-geometry'
import type { CanvasPoint } from './interaction-types'
import { CANVAS_TEXT_NODE_DEFAULT_SIZE } from './canvas-node-defaults'

const MINIMUM_TEXT_PLACEMENT_SIZE = 10

export function canvasTextPlacementDragBounds(
  origin: CanvasPoint,
  current: CanvasPoint,
  square: boolean,
): CanvasBounds {
  const constrained = square ? squarePoint(origin, current) : current
  return canvasBoundsFromPoints(origin, constrained)
}

export function resolveCanvasTextPlacementBounds(
  origin: CanvasPoint,
  current: CanvasPoint,
  square: boolean,
): CanvasBounds {
  const bounds = canvasTextPlacementDragBounds(origin, current, square)
  if (bounds.width >= MINIMUM_TEXT_PLACEMENT_SIZE && bounds.height >= MINIMUM_TEXT_PLACEMENT_SIZE) {
    return bounds
  }
  return {
    x: origin.x - CANVAS_TEXT_NODE_DEFAULT_SIZE.width / 2,
    y: origin.y - CANVAS_TEXT_NODE_DEFAULT_SIZE.height / 2,
    ...CANVAS_TEXT_NODE_DEFAULT_SIZE,
  }
}

function squarePoint(origin: CanvasPoint, current: CanvasPoint): CanvasPoint {
  const deltaX = current.x - origin.x
  const deltaY = current.y - origin.y
  const size = Math.min(Math.abs(deltaX), Math.abs(deltaY))
  return {
    x: origin.x + Math.sign(deltaX || 1) * size,
    y: origin.y + Math.sign(deltaY || 1) * size,
  }
}
