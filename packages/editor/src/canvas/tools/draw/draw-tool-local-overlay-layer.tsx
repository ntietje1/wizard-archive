import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  canvasStrokePointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'
import { useCanvasToolLocalOverlayRuntimeStore } from '../../runtime/providers/canvas-runtime'
import { resolveCanvasScreenMinimumStrokeWidth } from '../../screen-stroke-width'
import { useStore } from 'zustand'

export function DrawToolLocalOverlayLayer() {
  const localOverlayStore = useCanvasToolLocalOverlayRuntimeStore()
  const localDrawing = useStore(localOverlayStore, (state) => state.drawLocalDrawing)
  const viewport = useCanvasScreenSpaceViewport()

  const localPathD =
    localDrawing && localDrawing.points.length >= 2
      ? pointsToPathD(
          canvasStrokePointsToScreenPoints(localDrawing.points, viewport),
          resolveCanvasScreenMinimumStrokeWidth(localDrawing.size * viewport.zoom, 1),
        )
      : null

  if (!localPathD || !localDrawing) return null

  return (
    <CanvasScreenSpaceSvg>
      <path d={localPathD} fill={localDrawing.color} opacity={localDrawing.opacity / 100} />
    </CanvasScreenSpaceSvg>
  )
}
