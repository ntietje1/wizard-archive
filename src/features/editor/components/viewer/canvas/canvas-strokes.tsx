import { pointsToPathD } from './canvas-stroke-utils'
import type { RemoteUser } from './canvas-awareness-types'
import { useCanvasToolStore } from '~/features/editor/stores/canvas-tool-store'

interface CanvasStrokesProps {
  remoteUsers: Array<RemoteUser>
}

export function CanvasStrokes({ remoteUsers }: CanvasStrokesProps) {
  const localDrawing = useCanvasToolStore((s) => s.localDrawing)

  return (
    <svg
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
            opacity={0.7}
          />
        )
      })}

      {localDrawing && localDrawing.points.length >= 2 && (
        <path
          d={pointsToPathD(localDrawing.points, localDrawing.size)}
          fill={localDrawing.color}
        />
      )}
    </svg>
  )
}
