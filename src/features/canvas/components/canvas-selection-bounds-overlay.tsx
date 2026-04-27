import {
  CANVAS_SELECTION_CHROME_OUTSET_PX,
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  CANVAS_SELECTION_OVERLAY_Z_INDEX,
  canvasBoundsToScreenBounds,
  useCanvasScreenSpaceViewport,
} from './canvas-screen-space-overlay-utils'
import type { Bounds } from '../utils/canvas-geometry-utils'
import type { ReactNode } from 'react'

export function CanvasSelectionBoundsOverlay({
  bounds,
  children,
  testIdPrefix,
}: {
  bounds: Bounds
  children?: ReactNode
  testIdPrefix: string
}) {
  const viewport = useCanvasScreenSpaceViewport()
  const screenBounds = canvasBoundsToScreenBounds(bounds, viewport)

  return (
    <div
      data-testid={`${testIdPrefix}-wrapper`}
      className="absolute left-0 top-0 pointer-events-none"
      style={{
        height: screenBounds.height,
        transform: `translate(${screenBounds.x}px, ${screenBounds.y}px)`,
        width: screenBounds.width,
        zIndex: CANVAS_SELECTION_OVERLAY_Z_INDEX,
      }}
    >
      <div
        data-testid={`${testIdPrefix}-fill`}
        className="absolute inset-0 rounded-sm pointer-events-none bg-primary/5"
      />
      <div
        data-testid={`${testIdPrefix}-outline`}
        className="absolute rounded-sm pointer-events-none"
        style={{
          borderColor: 'var(--primary)',
          borderStyle: 'solid',
          borderWidth: CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
          inset: -CANVAS_SELECTION_CHROME_OUTSET_PX,
        }}
      />
      {children}
    </div>
  )
}
