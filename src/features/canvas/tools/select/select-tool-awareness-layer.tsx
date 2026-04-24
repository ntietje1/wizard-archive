import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteSelectRectState } from './select-tool-awareness'
import { CanvasRectOverlay } from '../shared/rect-overlay'

export function SelectAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  return (
    <svg
      aria-hidden="true"
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {remoteUsers.map((remoteUser) => {
        const selecting = readRemoteSelectRectState(remoteUser)
        if (!selecting) return null
        return (
          <CanvasRectOverlay
            key={`selection-${remoteUser.clientId}`}
            rect={selecting}
            color={remoteUser.user.color}
            fillOpacity={0.06}
          />
        )
      })}
    </svg>
  )
}
