import {
  CanvasScreenSpaceRectChrome,
  CanvasScreenSpaceSvg,
} from '../../components/canvas-screen-space-overlay'
import {
  canvasBoundsToScreenBounds,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { useCanvasToolLocalOverlayRuntimeStore } from '../../runtime/providers/canvas-runtime'
import { useStore } from 'zustand'

export function SelectToolLocalOverlayLayer() {
  const localOverlayStore = useCanvasToolLocalOverlayRuntimeStore()
  const selectionDragRect = useStore(localOverlayStore, (state) => state.selectSelectionDragRect)
  const viewport = useCanvasScreenSpaceViewport()

  if (!selectionDragRect) return null
  const screenRect = canvasBoundsToScreenBounds(selectionDragRect, viewport)

  return (
    <div data-testid="canvas-marquee-overlay" className="absolute inset-0 pointer-events-none">
      <CanvasScreenSpaceSvg>
        <CanvasScreenSpaceRectChrome bounds={screenRect} />
      </CanvasScreenSpaceSvg>
    </div>
  )
}
