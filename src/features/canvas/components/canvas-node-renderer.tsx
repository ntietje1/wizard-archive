import { memo } from 'react'
import { CanvasNodeWrapper } from './canvas-node-wrapper'
import { areArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasDocumentNode } from 'convex/canvases/validation'
import type { ComponentType, MouseEvent as ReactMouseEvent } from 'react'

export const CanvasNodeRenderer = memo(function CanvasNodeRenderer({
  onNodeClick,
  onNodeContextMenu,
  NodeContentComponent,
}: {
  onNodeClick?: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasDocumentNode) => void
  NodeContentComponent: ComponentType<{ nodeId: string }>
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasNodeWrapper
      key={nodeId}
      nodeId={nodeId}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
    >
      <NodeContentComponent nodeId={nodeId} />
    </CanvasNodeWrapper>
  ))
})
