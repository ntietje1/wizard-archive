import { useDrawToolLocalOverlayStore } from './draw-tool-local-overlay'
import { pointsToPathD } from '../../nodes/stroke/stroke-node-model'

export function DrawToolLocalOverlayLayer() {
  const localDrawing = useDrawToolLocalOverlayStore((state) => state.localDrawing)

  const localPathD =
    localDrawing && localDrawing.points.length >= 2
      ? pointsToPathD(localDrawing.points, localDrawing.size)
      : null

  if (!localPathD || !localDrawing) return null

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
      <path
        d={localPathD}
        fill={localDrawing.color}
        opacity={(localDrawing.opacity ?? 100) / 100}
      />
    </svg>
  )
}
