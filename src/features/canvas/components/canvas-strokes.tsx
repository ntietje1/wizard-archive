import { pointsToPathD } from '../utils/canvas-stroke-utils'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { RemoteUser } from '../utils/canvas-awareness-types'

const REMOTE_STROKE_OPACITY_MULTIPLIER = 0.7

interface CanvasStrokesProps {
  remoteUsers: Array<RemoteUser>
}

export function CanvasStrokes({ remoteUsers }: CanvasStrokesProps) {
  const localDrawing = useCanvasToolStore((s) => s.localDrawing)

  const localPathD =
    localDrawing && localDrawing.points.length >= 2
      ? pointsToPathD(localDrawing.points, localDrawing.size)
      : null

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
            opacity={
              ((user.drawing.opacity ?? 100) / 100) *
              REMOTE_STROKE_OPACITY_MULTIPLIER
            }
          />
        )
      })}

      {localPathD && (
        <path
          d={localPathD}
          fill={localDrawing!.color}
          opacity={(localDrawing!.opacity ?? 100) / 100}
        />
      )}
    </svg>
  )
}
