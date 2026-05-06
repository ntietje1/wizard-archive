import { useSelectToolLocalOverlayStore } from './select-tool-local-overlay'
import {
  CanvasScreenSpaceRectChrome,
  CanvasScreenSpaceSvg,
} from '../../components/canvas-screen-space-overlay'
import {
  canvasBoundsToScreenBounds,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'

export function SelectToolLocalOverlayLayer() {
  const selectionDragRect = useSelectToolLocalOverlayStore((state) => state.selectionDragRect)
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
