import type { RemoteUser } from '../../utils/canvas-awareness-types'
import { readRemoteLassoState } from './lasso-tool-awareness'
import { CanvasScreenSpaceSvg } from '../../components/canvas-screen-space-overlay'
import {
  CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  canvasPointsToScreenPoints,
  useCanvasScreenSpaceViewport,
} from '../../components/canvas-screen-space-overlay-utils'

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
    strokeWidth: CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  }

  if (points.length >= 3) {
    return (
      <polygon
        key={key}
        data-testid="canvas-remote-lasso-preview"
        points={pointsValue}
        fill={color}
        fillOpacity={fillOpacity}
        {...strokeProps}
      />
    )
  }

  return (
    <polyline
      key={key}
      data-testid="canvas-remote-lasso-preview"
      points={pointsValue}
      fill="none"
      {...strokeProps}
    />
  )
}

export function LassoAwarenessLayer({ remoteUsers }: { remoteUsers: ReadonlyArray<RemoteUser> }) {
  const viewport = useCanvasScreenSpaceViewport()

  return (
    <CanvasScreenSpaceSvg>
      {remoteUsers.map((remoteUser) => {
        const selecting = readRemoteLassoState(remoteUser)
        if (!selecting) return null
        const points = selecting.points
        if (points.length < 2) return null

        return renderLassoShape({
          key: `lasso-${remoteUser.clientId}`,
          points: canvasPointsToScreenPoints(points, viewport),
          color: remoteUser.user.color,
          fillOpacity: 0.06,
        })
      })}
    </CanvasScreenSpaceSvg>
  )
}
