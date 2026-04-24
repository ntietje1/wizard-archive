import { useRectCreationLocalOverlayStore } from './rect-creation-local-overlay'
import { CanvasRectOverlay } from './rect-overlay'

export function RectCreationLocalOverlayLayer() {
  const dragRect = useRectCreationLocalOverlayStore((state) => state.dragRect)

  if (!dragRect) {
    return null
  }

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
      <CanvasRectOverlay rect={dragRect} />
    </svg>
  )
}
