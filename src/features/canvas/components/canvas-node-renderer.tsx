import { memo } from 'react'
import { CanvasNodeWrapper } from './canvas-node-wrapper'
import { areArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { CanvasNode } from '../types/canvas-domain-types'
import type { MouseEvent as ReactMouseEvent } from 'react'

export const CanvasNodeRenderer = memo(function CanvasNodeRenderer({
  onNodeClick,
  onNodeContextMenu,
}: {
  onNodeClick?: (event: ReactMouseEvent, node: CanvasNode) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: CanvasNode) => void
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasNodeWrapper
      key={nodeId}
      nodeId={nodeId}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
    />
  ))
})
