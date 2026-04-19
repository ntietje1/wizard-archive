import { useReactFlow } from '@xyflow/react'
import { getNextSelectedNodeIds } from '../../utils/canvas-selection-utils'
import { useCanvasSelectionState } from './use-canvas-selection-state'
import type { CanvasSelectionController } from '../../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'

type SelectionProjectionReactFlow = Pick<ReactFlowInstance, 'setNodes'> &
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

function replaceCanvasSelection(
  reactFlow: SelectionProjectionReactFlow,
  selectedNodeIds: Array<string>,
) {
  useCanvasSelectionState.getState().setSelectedNodeIds(selectedNodeIds)
  projectCanvasSelectionToReactFlow(reactFlow, selectedNodeIds)
}

export function useCanvasSelectionActions(): CanvasSelectionController {
  const reactFlow = useReactFlow()

  return {
    replace: (nodeIds) => {
      replaceCanvasSelection(reactFlow, nodeIds)
    },
    clear: () => {
      replaceCanvasSelection(reactFlow, [])
    },
    getSelectedNodeIds: () => useCanvasSelectionState.getState().selectedNodeIds,
    toggleFromTarget: (targetId, toggle) => {
      const nextIds = getNextSelectedNodeIds({
        selectedNodeIds: useCanvasSelectionState.getState().selectedNodeIds,
        targetId,
        toggle,
      })
      queueMicrotask(() => {
        replaceCanvasSelection(reactFlow, nextIds)
      })
    },
    beginGesture: (kind) => {
      useCanvasSelectionState.getState().beginGesture(kind)
    },
    commitGestureSelection: (nodeIds) => {
      replaceCanvasSelection(reactFlow, nodeIds)
    },
    endGesture: () => {
      useCanvasSelectionState.getState().endGesture()
    },
  }
}
