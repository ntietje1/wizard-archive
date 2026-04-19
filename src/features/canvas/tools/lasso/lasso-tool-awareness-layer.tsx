import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteLassoState } from './lasso-tool-awareness'

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
        const selecting = readRemoteLassoState(remoteUser)
        if (!selecting) return null
        const points = selecting.points
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
