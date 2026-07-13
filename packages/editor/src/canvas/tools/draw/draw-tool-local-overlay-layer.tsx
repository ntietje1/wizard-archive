import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  canvasStrokePointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'
import { useCanvasToolLocalOverlayRuntimeStore } from '../../runtime/providers/canvas-runtime'
import { resolveScreenSpaceStrokeWidth } from '../../screen-stroke-width'
import { useStore } from 'zustand'

export function DrawToolLocalOverlayLayer() {
  const localOverlayStore = useCanvasToolLocalOverlayRuntimeStore()
  const localDrawing = useStore(localOverlayStore, (state) => state.drawLocalDrawing)
  const viewport = useCanvasScreenSpaceViewport()

  const localPathD =
    localDrawing && localDrawing.points.length >= 2
      ? pointsToPathD(
          canvasStrokePointsToScreenPoints(localDrawing.points, viewport),
          resolveScreenSpaceStrokeWidth(localDrawing.size, viewport.zoom),
        )
      : null

  if (!localPathD || !localDrawing) return null

  return (
    <CanvasScreenSpaceSvg>
      <path d={localPathD} fill={localDrawing.color} opacity={localDrawing.opacity / 100} />
    </CanvasScreenSpaceSvg>
  )
}
