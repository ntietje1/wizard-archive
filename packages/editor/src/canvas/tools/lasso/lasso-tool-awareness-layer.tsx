import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteLassoState } from './lasso-tool-awareness'
import { renderLassoShape } from './lasso-tool-shape'
import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import { useCanvasScreenSpaceViewport } from '../../components/canvas-screen-space-overlay-utils'
import { projectCanvasToolOverlayPoints } from '../shared/tool-module-utils'

export function LassoAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  const viewport = useCanvasScreenSpaceViewport()

  return (
    <CanvasScreenSpaceSvg>
      {remoteUsers.map((remoteUser) => {
        const selecting = readRemoteLassoState(remoteUser)
        if (!selecting) return null
        const points = projectCanvasToolOverlayPoints(selecting.points, viewport)
        if (!points) return null

        return renderLassoShape({
          key: `lasso-${remoteUser.clientId}`,
          points,
          stroke: remoteUser.user.color,
          fill: remoteUser.user.color,
          fillOpacity: 0.06,
          testId: 'canvas-remote-lasso-preview',
        })
      })}
    </CanvasScreenSpaceSvg>
  )
}
