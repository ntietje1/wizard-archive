import { useSyncExternalStore } from 'react'
import { useCanvasEngine } from '../react/canvas-engine-context-value'
import type { CanvasViewport } from '../types/canvas-domain-types'
import type { Bounds } from '../utils/canvas-geometry-utils'

export const CANVAS_SELECTION_CHROME_FILL = 'var(--canvas-selection-fill)'
export const CANVAS_SELECTION_CHROME_FILL_OPACITY = 1
export const CANVAS_SELECTION_CHROME_STROKE = 'var(--canvas-selection-stroke)'
export const CANVAS_SELECTION_CHROME_OUTSET_PX = 3
export const CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX = 1.5
export const CANVAS_SELECTION_OVERLAY_Z_INDEX = 30
export const CANVAS_AWARENESS_OVERLAY_Z_INDEX = 40
export const CANVAS_LOCAL_OVERLAY_Z_INDEX = 4
export const CANVAS_SNAP_GUIDE_STROKE = 'var(--canvas-snap-guide)'
export const CANVAS_SNAP_GUIDE_STROKE_OPACITY = 'var(--canvas-snap-guide-opacity)'
export const CANVAS_SNAP_GUIDE_STROKE_WIDTH_PX = 1.5

export function useCanvasScreenSpaceViewport() {
  const canvasEngine = useCanvasEngine()
  return useSyncExternalStore(
    canvasEngine.subscribeViewportChange,
    () => canvasEngine.getSnapshot().viewport,
    () => canvasEngine.getSnapshot().viewport,
  )
}

export function canvasPointToScreenPoint(
  point: { x: number; y: number },
  viewport: CanvasViewport,
) {
  return {
    x: viewport.x + point.x * viewport.zoom,
    y: viewport.y + point.y * viewport.zoom,
  }
}

export function canvasBoundsToScreenBounds(bounds: Bounds, viewport: CanvasViewport): Bounds {
  return {
    x: viewport.x + bounds.x * viewport.zoom,
    y: viewport.y + bounds.y * viewport.zoom,
    width: bounds.width * viewport.zoom,
    height: bounds.height * viewport.zoom,
  }
}

export function canvasPointsToScreenPoints<TPoint extends { x: number; y: number }>(
  points: ReadonlyArray<TPoint>,
  viewport: CanvasViewport,
): Array<Omit<TPoint, 'x' | 'y'> & { x: number; y: number }> {
  return points.map((point) => ({
    ...point,
    ...canvasPointToScreenPoint(point, viewport),
  }))
}

export function canvasStrokePointsToScreenPoints(
  points: ReadonlyArray<[number, number, number]>,
  viewport: CanvasViewport,
): Array<[number, number, number]> {
  return points.map(([x, y, pressure]) => [
    viewport.x + x * viewport.zoom,
    viewport.y + y * viewport.zoom,
    pressure,
  ])
}

export function normalizeScreenBounds(bounds: Bounds): Bounds {
  return {
    x: Math.min(bounds.x, bounds.x + bounds.width),
    y: Math.min(bounds.y, bounds.y + bounds.height),
    width: Math.abs(bounds.width),
    height: Math.abs(bounds.height),
  }
}
