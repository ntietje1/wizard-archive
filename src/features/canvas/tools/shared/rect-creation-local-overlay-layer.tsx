import { useRectCreationLocalOverlayStore } from './rect-creation-local-overlay'
import {
  CanvasScreenSpaceRectChrome,
  CanvasScreenSpaceSvg,
} from '../../components/canvas-screen-space-overlay'
import {
  canvasBoundsToScreenBounds,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'

export function RectCreationLocalOverlayLayer() {
  const dragRect = useRectCreationLocalOverlayStore((state) => state.dragRect)
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
