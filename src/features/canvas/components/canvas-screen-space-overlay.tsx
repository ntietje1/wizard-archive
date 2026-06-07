import {
  CANVAS_SELECTION_CHROME_FILL,
  CANVAS_SELECTION_CHROME_FILL_OPACITY,
  CANVAS_SELECTION_CHROME_STROKE,
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  normalizeScreenBounds,
} from './canvas-screen-space-overlay-utils'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { CSSProperties, ReactNode } from 'react'

const OVERLAY_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  overflow: 'visible',
  pointerEvents: 'none',
}

export function CanvasScreenSpaceSvg({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" width="100%" height="100%" style={OVERLAY_STYLE}>
      {children}
    </svg>
  )
}

export function CanvasScreenSpaceRectChrome({
  bounds,
  color,
  fillColor,
  fillOpacity = CANVAS_SELECTION_CHROME_FILL_OPACITY,
  testId,
}: {
  bounds: Bounds
  color?: string
  fillColor?: string
  fillOpacity?: number
  testId?: string
}) {
  const normalizedBounds = normalizeScreenBounds(bounds)
  const strokeColor = color ?? CANVAS_SELECTION_CHROME_STROKE
  const rectFillColor = fillColor ?? color ?? CANVAS_SELECTION_CHROME_FILL

  return (
    <rect
      x={normalizedBounds.x}
      y={normalizedBounds.y}
      width={normalizedBounds.width}
      height={normalizedBounds.height}
      fill={rectFillColor}
      fillOpacity={fillOpacity}
      stroke={strokeColor}
      strokeWidth={CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX}
      data-testid={testId}
    />
  )
}
