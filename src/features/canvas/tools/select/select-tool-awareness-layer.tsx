import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteSelectRectState } from './select-tool-awareness'
import {
  CanvasScreenSpaceRectChrome,
  CanvasScreenSpaceSvg,
} from '../../components/canvas-screen-space-overlay'
import {
  canvasBoundsToScreenBounds,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'

export function SelectAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  const viewport = useCanvasScreenSpaceViewport()

  return (
    <CanvasScreenSpaceSvg>
      {remoteUsers.map((remoteUser) => {
        const selecting = readRemoteSelectRectState(remoteUser)
        if (!selecting) return null
        return (
          <CanvasScreenSpaceRectChrome
            key={`selection-${remoteUser.clientId}`}
            bounds={canvasBoundsToScreenBounds(selecting, viewport)}
            color={remoteUser.user.color}
            fillOpacity={0.06}
          />
        )
      })}
    </CanvasScreenSpaceSvg>
  )
}
