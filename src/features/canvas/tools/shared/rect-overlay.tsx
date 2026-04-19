import type { Bounds } from '../../utils/canvas-geometry-utils'

function normalizeRect(rect: Bounds) {
  return {
    x: Math.min(rect.x, rect.x + rect.width),
    y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width),
    height: Math.abs(rect.height),
  }
}

export function CanvasRectOverlay({
  rect,
  color = 'var(--primary)',
  fillOpacity = 0.08,
}: {
  rect: Bounds
  color?: string
  fillOpacity?: number
}) {
  const normalizedRect = normalizeRect(rect)

  return (
    <rect
      x={normalizedRect.x}
      y={normalizedRect.y}
      width={normalizedRect.width}
      height={normalizedRect.height}
      fill={color}
      fillOpacity={fillOpacity}
      stroke={color}
      strokeWidth={1}
      strokeDasharray="3 3"
    />
  )
}
