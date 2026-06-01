import { CanvasPreviewEdge } from './canvas-preview-edge'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasDocumentEdge } from '~/features/canvas/domain/validation'
import type { MouseEvent as ReactMouseEvent } from 'react'

export function CanvasPreviewEdgeLayer({
  edgeId,
  interactive,
  onEdgeContextMenu,
}: {
  edgeId: string
  interactive: boolean
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const zIndex = useCanvasEngineSelector(
    (snapshot) => snapshot.edgeLookup.get(edgeId)?.zIndex ?? null,
  )

  if (zIndex === null) {
    return null
  }

  return (
    <svg
      className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
      aria-hidden="true"
      data-canvas-edge-layer="true"
      data-canvas-edge-layer-id={edgeId}
      style={{ zIndex }}
      width="1"
      height="1"
    >
      <CanvasPreviewEdge
        edgeId={edgeId}
        interactive={interactive}
        onEdgeContextMenu={onEdgeContextMenu}
      />
    </svg>
  )
}
