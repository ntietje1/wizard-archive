import type { CanvasPoint, CanvasViewport } from './interaction-types'

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = Object.freeze({ x: 0, y: 0, zoom: 1 })

export function screenToCanvasPoint(
  point: CanvasPoint,
  viewport: CanvasViewport,
  surfaceOrigin: CanvasPoint = { x: 0, y: 0 },
): CanvasPoint {
  return {
    x: (point.x - surfaceOrigin.x - viewport.x) / viewport.zoom,
    y: (point.y - surfaceOrigin.y - viewport.y) / viewport.zoom,
  }
}

export function canvasToScreenPoint(
  point: CanvasPoint,
  viewport: CanvasViewport,
  surfaceOrigin: CanvasPoint = { x: 0, y: 0 },
): CanvasPoint {
  return {
    x: surfaceOrigin.x + viewport.x + point.x * viewport.zoom,
    y: surfaceOrigin.y + viewport.y + point.y * viewport.zoom,
  }
}
