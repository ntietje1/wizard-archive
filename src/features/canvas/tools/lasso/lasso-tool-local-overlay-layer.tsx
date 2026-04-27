import { useLassoToolLocalOverlayStore } from './lasso-tool-local-overlay'
import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  CANVAS_SELECTION_CHROME_FILL_OPACITY,
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  canvasPointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'

export function LassoToolLocalOverlayLayer() {
  const lassoPath = useLassoToolLocalOverlayStore((state) => state.points)
  const viewport = useCanvasScreenSpaceViewport()

  if (lassoPath.length < 2) return null
  const screenPoints = canvasPointsToScreenPoints(lassoPath, viewport)

  return (
    <div data-testid="canvas-lasso-overlay" className="absolute inset-0 pointer-events-none">
      <CanvasScreenSpaceSvg>
        <polygon
          points={screenPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="var(--primary)"
          fillOpacity={CANVAS_SELECTION_CHROME_FILL_OPACITY}
          stroke="var(--primary)"
          strokeWidth={CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX}
        />
      </CanvasScreenSpaceSvg>
    </div>
  )
}
