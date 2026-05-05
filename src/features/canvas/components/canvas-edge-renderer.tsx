import { memo } from 'react'
import { CanvasEdgeWrapper } from './canvas-edge-wrapper'
import { areArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasDocumentEdge } from 'convex/canvases/validation'
import type { MouseEvent as ReactMouseEvent } from 'react'

export const CanvasEdgeRenderer = memo(function CanvasEdgeRenderer({
  onEdgeClick,
  onEdgeContextMenu,
}: {
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeIds = useCanvasEngineSelector((snapshot) => snapshot.edgeIds, areArraysEqual)
  return edgeIds.map((edgeId) => (
    <CanvasEdgeWrapper
      key={edgeId}
      edgeId={edgeId}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
})
