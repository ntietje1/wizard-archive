import { memo } from 'react'
import { CanvasNodeWrapper } from './canvas-node-wrapper'
import { areStringArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { Node } from '@xyflow/react'
import type { MouseEvent as ReactMouseEvent } from 'react'

export const CanvasNodeRenderer = memo(function CanvasNodeRenderer({
  onNodeClick,
  onNodeContextMenu,
}: {
  onNodeClick?: (event: ReactMouseEvent, node: Node) => void
  onNodeContextMenu: (event: ReactMouseEvent, node: Node) => void
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areStringArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasNodeWrapper
      key={nodeId}
      nodeId={nodeId}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
    />
  ))
})
