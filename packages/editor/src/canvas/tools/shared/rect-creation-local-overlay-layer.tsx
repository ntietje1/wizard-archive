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

export function RectCreationLocalOverlayLayer() {
  const localOverlayStore = useCanvasToolLocalOverlayRuntimeStore()
  const dragRect = useStore(localOverlayStore, (state) => state.rectCreationDragRect)
  const viewport = useCanvasScreenSpaceViewport()

  if (!dragRect) {
    return null
  }
  const screenRect = canvasBoundsToScreenBounds(dragRect, viewport)

  return (
    <CanvasScreenSpaceSvg>
      <CanvasScreenSpaceRectChrome bounds={screenRect} />
    </CanvasScreenSpaceSvg>
  )
}
