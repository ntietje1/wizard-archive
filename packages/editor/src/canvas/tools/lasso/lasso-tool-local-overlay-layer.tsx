import { renderLassoShape } from './lasso-tool-shape'
import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  CANVAS_SELECTION_CHROME_FILL,
  CANVAS_SELECTION_CHROME_FILL_OPACITY,
  CANVAS_SELECTION_CHROME_STROKE,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { useCanvasToolLocalOverlayRuntimeStore } from '../../runtime/providers/canvas-runtime'
import { projectCanvasToolOverlayPoints } from '../shared/tool-module-utils'
import { useStore } from 'zustand'

export function LassoToolLocalOverlayLayer() {
  const localOverlayStore = useCanvasToolLocalOverlayRuntimeStore()
  const lassoPath = useStore(localOverlayStore, (state) => state.lassoPoints)
  const viewport = useCanvasScreenSpaceViewport()
  const screenPoints = projectCanvasToolOverlayPoints(lassoPath, viewport)

  if (!screenPoints) return null

  return (
    <div data-testid="canvas-lasso-overlay" className="absolute inset-0 pointer-events-none">
      <CanvasScreenSpaceSvg>
        {renderLassoShape({
          points: screenPoints,
          stroke: CANVAS_SELECTION_CHROME_STROKE,
          fill: CANVAS_SELECTION_CHROME_FILL,
          fillOpacity: CANVAS_SELECTION_CHROME_FILL_OPACITY,
          testId: 'canvas-local-lasso-preview',
        })}
      </CanvasScreenSpaceSvg>
    </div>
  )
}
