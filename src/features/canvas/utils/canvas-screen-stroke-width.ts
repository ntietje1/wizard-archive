import type { CSSProperties } from 'react'

const MIN_CANVAS_SCREEN_STROKE_WIDTH_PX = 1
const MIN_CANVAS_ZOOM_FOR_CSS_STROKE_WIDTH = 0.0001

interface CanvasScreenMinimumStrokeWidthOptions {
  allowZero?: boolean
}

export function resolveCanvasScreenMinimumStrokeWidth(
  authoredWidth: number,
  zoom: number,
  options: CanvasScreenMinimumStrokeWidthOptions = {},
): number {
  if (options.allowZero && authoredWidth === 0) {
    return 0
  }

  const safeAuthoredWidth = Number.isFinite(authoredWidth) ? Math.max(0, authoredWidth) : 0
  const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
  return Math.max(safeAuthoredWidth, MIN_CANVAS_SCREEN_STROKE_WIDTH_PX / safeZoom)
}

export function resolveCanvasScreenMinimumStrokeWidthCss(
  authoredWidth: number,
  options: CanvasScreenMinimumStrokeWidthOptions = {},
): NonNullable<CSSProperties['strokeWidth']> {
  if (options.allowZero && authoredWidth === 0) {
    return 0
  }

  const safeAuthoredWidth = Number.isFinite(authoredWidth) ? Math.max(0, authoredWidth) : 0
  return `max(${safeAuthoredWidth}px, calc(${MIN_CANVAS_SCREEN_STROKE_WIDTH_PX}px / max(var(--canvas-zoom, 1), ${MIN_CANVAS_ZOOM_FOR_CSS_STROKE_WIDTH})))`
}
