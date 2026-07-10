import { CanvasNodeWrapper } from './canvas-node-wrapper'
import { areArraysEqual } from './canvas-renderer-utils'
import { useCanvasEngineSelector } from '../react/use-canvas-engine'
import type { ComponentType } from 'react'

export function CanvasNodeRenderer({
  NodeContentComponent,
}: {
  NodeContentComponent: ComponentType<{ nodeId: string }>
}) {
  const nodeIds = useCanvasEngineSelector((snapshot) => snapshot.nodeIds, areArraysEqual)
  return nodeIds.map((nodeId) => (
    <CanvasNodeWrapper key={nodeId} nodeId={nodeId}>
      <NodeContentComponent nodeId={nodeId} />
    </CanvasNodeWrapper>
  ))
}
