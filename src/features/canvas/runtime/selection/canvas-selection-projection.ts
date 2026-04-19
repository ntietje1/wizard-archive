import { useCanvasSelectionState } from './use-canvas-selection-state'
import type { ReactFlowInstance } from '@xyflow/react'

export type SelectionProjectionReactFlow = Pick<ReactFlowInstance, 'setNodes'> &
  Partial<Pick<ReactFlowInstance, 'setEdges'>>

function projectCanvasSelectionToReactFlow(
  reactFlow: SelectionProjectionReactFlow,
  selectedNodeIds: Array<string>,
) {
  const nodeIdSet = new Set(selectedNodeIds)
  reactFlow.setNodes((nodes) =>
    nodes.map((node) => {
      const selected = nodeIdSet.has(node.id)
      const draggable = selected
      if (node.selected === selected && (node.draggable ?? false) === draggable) {
        return node
      }
      return { ...node, selected, draggable }
    }),
  )
  reactFlow.setEdges?.((edges) =>
    edges.map((edge) => {
      const selected = nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target)
      return edge.selected === selected ? edge : { ...edge, selected }
    }),
  )
}

export function setCanvasSelection(
  reactFlow: SelectionProjectionReactFlow,
  selectedNodeIds: Array<string>,
) {
  useCanvasSelectionState.getState().setSelectedNodeIds(selectedNodeIds)
  projectCanvasSelectionToReactFlow(reactFlow, selectedNodeIds)
}
