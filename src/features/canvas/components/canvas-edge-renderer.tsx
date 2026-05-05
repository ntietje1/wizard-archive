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
    <CanvasEdgeLayer
      key={edgeId}
      edgeId={edgeId}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
})

const CanvasEdgeLayer = memo(function CanvasEdgeLayer({
  edgeId,
  onEdgeClick,
  onEdgeContextMenu,
}: {
  edgeId: string
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasDocumentEdge) => void
}) {
  const edgeLayer = useCanvasEngineSelector((snapshot) => {
    const internalEdge = snapshot.edgeLookup.get(edgeId)
    return internalEdge ? { visible: internalEdge.visible, zIndex: internalEdge.zIndex } : null
  }, areCanvasEdgeLayersEqual)

  if (!edgeLayer?.visible) {
    return null
  }

  return (
    <svg
      className="canvas-edge-layer pointer-events-none absolute left-0 top-0 overflow-visible"
      data-canvas-edge-layer="true"
      data-canvas-edge-layer-id={edgeId}
      style={{ zIndex: edgeLayer.zIndex }}
      width="1"
      height="1"
    >
      <CanvasEdgeWrapper
        edgeId={edgeId}
        onEdgeClick={onEdgeClick}
        onEdgeContextMenu={onEdgeContextMenu}
      />
    </svg>
  )
})

function areCanvasEdgeLayersEqual(
  left: { visible: boolean; zIndex: number } | null,
  right: { visible: boolean; zIndex: number } | null,
) {
  if (left === right) {
    return true
  }

  return Boolean(left && right && left.visible === right.visible && left.zIndex === right.zIndex)
}
