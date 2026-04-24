import { useLassoToolLocalOverlayStore } from './lasso-tool-local-overlay'

export function LassoToolLocalOverlayLayer() {
  const lassoPath = useLassoToolLocalOverlayStore((state) => state.points)

  if (lassoPath.length < 2) return null

  return (
    <svg
      data-testid="canvas-lasso-overlay"
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
      <polygon
        points={lassoPath.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="var(--primary)"
        fillOpacity={0.08}
        stroke="var(--primary)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
    </svg>
  )
}
