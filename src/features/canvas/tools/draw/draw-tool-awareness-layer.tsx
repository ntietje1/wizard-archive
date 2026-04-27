import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  canvasStrokePointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'
import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'
import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteDrawState } from './draw-tool-awareness'

export function DrawAwarenessLayer({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const viewport = useCanvasScreenSpaceViewport()

  return (
    <CanvasScreenSpaceSvg>
      {remoteUsers.map((user) => {
        const drawing = readRemoteDrawState(user)
        if (!drawing || drawing.points.length < 2) return null
        const d = pointsToPathD(
          canvasStrokePointsToScreenPoints(drawing.points, viewport),
          drawing.size * viewport.zoom,
        )
        if (!d) return null
        return (
          <path
            key={`remote-${user.clientId}`}
            d={d}
            fill={drawing.color}
            opacity={((drawing.opacity ?? 100) / 100) * 0.7}
          />
        )
      })}
    </CanvasScreenSpaceSvg>
  )
}
