import { useSelectToolLocalOverlayStore } from './select-tool-local-overlay'
import { CanvasRectOverlay } from '../shared/rect-overlay'

export function SelectToolLocalOverlayLayer() {
  const selectionDragRect = useSelectToolLocalOverlayStore((state) => state.selectionDragRect)

  if (!selectionDragRect) return null

  return (
    <svg
      data-testid="canvas-marquee-overlay"
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
      <CanvasRectOverlay rect={selectionDragRect} />
    </svg>
  )
}
