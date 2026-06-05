import { CanvasPathEdgeVisual } from '../edges/shared/canvas-path-edge'
import {
  areCanvasPreviewEdgeRendersEqual,
  selectCanvasPreviewEdgeRender,
} from './canvas-read-only-preview-model'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { CanvasDocumentEdge } from '~/features/canvas/domain/canvas-document'

export function CanvasPreviewEdge({
  edgeId,
  interactive,
  onEdgeContextMenu,
}: {
  edgeId: string
  interactive: boolean
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeRender = useCanvasEngineSelector(
    (snapshot) => selectCanvasPreviewEdgeRender(snapshot, edgeId),
    areCanvasPreviewEdgeRendersEqual,
  )

  if (!edgeRender) {
    return null
  }

  return (
    <g
      className={interactive ? 'pointer-events-auto' : 'pointer-events-none'}
      data-canvas-edge-id={edgeRender.edge.id}
      onContextMenu={(event) => onEdgeContextMenu(event, edgeRender.edge)}
    >
      <CanvasPathEdgeVisual
        geometry={edgeRender.geometry}
        id={edgeRender.edge.id}
        type={edgeRender.type}
        style={edgeRender.edge.style}
      />
    </g>
  )
}
