import { memo } from 'react'
import { CanvasEdgeWrapper } from './canvas-edge-wrapper'
import { areStringArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasEdge } from '../types/canvas-domain-types'
import type { MouseEvent as ReactMouseEvent } from 'react'

export const CanvasEdgeRenderer = memo(function CanvasEdgeRenderer({
  onEdgeClick,
  onEdgeContextMenu,
}: {
  onEdgeClick?: (event: ReactMouseEvent, edge: CanvasEdge) => void
  onEdgeContextMenu: (event: ReactMouseEvent, edge: CanvasEdge) => void
}) {
  const edgeIds = useCanvasEngineSelector((snapshot) => snapshot.edgeIds, areStringArraysEqual)
  return edgeIds.map((edgeId) => (
    <CanvasEdgeWrapper
      key={edgeId}
      edgeId={edgeId}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
    />
  ))
})
