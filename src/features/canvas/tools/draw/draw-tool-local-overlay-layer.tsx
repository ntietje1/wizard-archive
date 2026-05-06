import { useDrawToolLocalOverlayStore } from './draw-tool-local-overlay'
import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  canvasStrokePointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'
import { resolveCanvasScreenMinimumStrokeWidth } from '../../utils/canvas-screen-stroke-width'

export function DrawToolLocalOverlayLayer() {
  const localDrawing = useDrawToolLocalOverlayStore((state) => state.localDrawing)
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
      <path
        d={localPathD}
        fill={localDrawing.color}
        opacity={(localDrawing.opacity ?? 100) / 100}
      />
    </CanvasScreenSpaceSvg>
  )
}
