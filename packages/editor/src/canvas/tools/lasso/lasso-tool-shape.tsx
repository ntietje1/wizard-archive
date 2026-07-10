import { CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX } from '../../components/canvas-screen-space-overlay-utils'

export function renderLassoShape({
  key,
  points,
  stroke,
  fill,
  fillOpacity,
  testId,
}: {
  key?: string
  points: Array<{ x: number; y: number }>
  stroke: string
  fill: string
  fillOpacity: number
  testId: string
}) {
  const pointsValue = points.map((point) => `${point.x},${point.y}`).join(' ')
  const strokeProps = {
    stroke,
    strokeWidth: CANVAS_SELECTION_CHROME_STROKE_WIDTH_PX,
  }

  if (points.length >= 3) {
    return (
      <polygon
        data-testid={testId}
        points={pointsValue}
        fill={fill}
        fillOpacity={fillOpacity}
        {...strokeProps}
        key={key}
      />
    )
  }

  return (
    <polyline data-testid={testId} points={pointsValue} fill="none" {...strokeProps} key={key} />
  )
}
