import {
  CANVAS_SELECTION_CHROME_FILL_OPACITY,
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
  color = 'var(--primary)',
  fillOpacity = CANVAS_SELECTION_CHROME_FILL_OPACITY,
}: {
  bounds: Bounds
  color?: string
  fillOpacity?: number
}) {
  const normalizedBounds = normalizeScreenBounds(bounds)

  return (
    <rect
      x={normalizedBounds.x}
      y={normalizedBounds.y}
      width={normalizedBounds.width}
      height={normalizedBounds.height}
      fill={color}
      fillOpacity={fillOpacity}
      stroke={color}
      strokeWidth={CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX}
    />
  )
}
