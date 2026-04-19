import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'
import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteDrawState } from './draw-tool-awareness'

export function DrawAwarenessLayer({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      {remoteUsers.map((user) => {
        const drawing = readRemoteDrawState(user)
        if (!drawing || drawing.points.length < 2) return null
        const d = pointsToPathD(drawing.points, drawing.size)
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
    </svg>
  )
}
