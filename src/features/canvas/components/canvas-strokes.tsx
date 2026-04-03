import { pointsToPathD } from '../utils/canvas-stroke-utils'
import { useCanvasToolStore } from '../stores/canvas-tool-store'
import type { RemoteUser } from '../utils/canvas-awareness-types'

export function MiniMapStrokePath(
  points: Array<[number, number, number]>,
  size: number,
  zoom: number,
): string {
  return pointsToPathD(points, (size + 12) / zoom)
}

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
            opacity={((user.drawing.opacity ?? 100) / 100) * 0.7}
          />
        )
      })}

      {localDrawing && localDrawing.points.length >= 2 && (
        <path
          d={pointsToPathD(localDrawing.points, localDrawing.size)}
          fill={localDrawing.color}
          opacity={(localDrawing.opacity ?? 100) / 100}
        />
      )}
    </svg>
  )
}
