import { useCanvasInteractionStore } from '../hooks/useCanvasInteractionStore'
import { pointsToPathD } from '../components/nodes/stroke-node-model'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function DrawAwarenessLayer({ remoteUsers }: { remoteUsers: Array<RemoteUser> }) {
  const localDrawing = useCanvasInteractionStore((state) => state.localDrawing)

  const localPathD =
    localDrawing && localDrawing.points.length >= 2
      ? pointsToPathD(localDrawing.points, localDrawing.size)
      : null

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
        if (!user.drawing || user.drawing.points.length < 2) return null
        const d = pointsToPathD(user.drawing.points, user.drawing.size)
        if (!d) return null
        return (
          <path
            key={`remote-${user.clientId}`}
            d={d}
            fill={user.drawing.color}
            opacity={((user.drawing.opacity ?? 100) / 100) * 0.7}
          />
        )
      })}

      {localPathD && localDrawing && (
        <path
          d={localPathD}
          fill={localDrawing.color}
          opacity={(localDrawing.opacity ?? 100) / 100}
        />
      )}
    </svg>
  )
}
