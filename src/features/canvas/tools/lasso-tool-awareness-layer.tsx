import { useCanvasInteractionStore } from '../hooks/useCanvasInteractionStore'
import type { RemoteUser } from '../utils/canvas-awareness-types'

function renderLassoShape({
  key,
  points,
  color,
  fillOpacity,
}: {
  key: string
  points: Array<{ x: number; y: number }>
  color: string
  fillOpacity: number
}) {
  const pointsValue = points.map((point) => `${point.x},${point.y}`).join(' ')
  const strokeProps = {
    stroke: color,
    strokeWidth: 1,
    strokeDasharray: '3 3',
  }

  if (points.length >= 3) {
    return (
      <polygon
        key={key}
        points={pointsValue}
        fill={color}
        fillOpacity={fillOpacity}
        {...strokeProps}
      />
    )
  }

  return <polyline key={key} points={pointsValue} fill="none" {...strokeProps} />
}

export function LassoAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  const lassoPath = useCanvasInteractionStore((state) => state.lassoPath)

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
      {lassoPath.length >= 2 &&
        renderLassoShape({
          key: 'local-lasso',
          points: lassoPath,
          color: 'var(--primary)',
          fillOpacity: 0.08,
        })}

      {remoteUsers.map((remoteUser) => {
        if (!remoteUser.selecting || remoteUser.selecting.type !== 'lasso') return null
        const points = remoteUser.selecting.points
        if (points.length < 2) return null

        return renderLassoShape({
          key: `lasso-${remoteUser.clientId}`,
          points,
          color: remoteUser.user.color,
          fillOpacity: 0.06,
        })
      })}
    </svg>
  )
}
