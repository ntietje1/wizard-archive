import { useReactFlow } from '@xyflow/react'
import {
  applyCanvasSelectionCommitMode,
  getNextSelectedIds,
} from '../../utils/canvas-selection-utils'
import {
  getCanvasSelectionSnapshot,
  setCanvasSelectionSnapshot,
  useCanvasSelectionState,
} from './use-canvas-selection-state'
import type {
  CanvasSelectionCommitMode,
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'

type SelectionProjectionReactFlow = Pick<ReactFlowInstance, 'setNodes'> &
  Partial<Pick<ReactFlowInstance, 'setEdges'>>

function projectCanvasSelectionToReactFlow(
  reactFlow: SelectionProjectionReactFlow,
  selection: CanvasSelectionSnapshot,
) {
  const nodeIdSet = new Set(selection.nodeIds)
  const edgeIdSet = new Set(selection.edgeIds)
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
      const selected = edgeIdSet.has(edge.id)
      return edge.selected === selected ? edge : { ...edge, selected }
    }),
  )
}

function replaceCanvasSelection(
  reactFlow: SelectionProjectionReactFlow,
  selection: CanvasSelectionSnapshot,
) {
  setCanvasSelectionSnapshot(selection)
  projectCanvasSelectionToReactFlow(reactFlow, selection)
}

export function useCanvasSelectionActions(): CanvasSelectionController {
  const reactFlow = useReactFlow()

  return {
    replace: (selection) => {
      replaceCanvasSelection(reactFlow, selection)
    },
    replaceNodes: (nodeIds) => {
      replaceCanvasSelection(reactFlow, { nodeIds, edgeIds: [] })
    },
    replaceEdges: (edgeIds) => {
      replaceCanvasSelection(reactFlow, { nodeIds: [], edgeIds })
    },
    clear: () => {
      replaceCanvasSelection(reactFlow, { nodeIds: [], edgeIds: [] })
    },
    getSelectedNodeIds: () => useCanvasSelectionState.getState().selectedNodeIds,
    getSelectedEdgeIds: () => useCanvasSelectionState.getState().selectedEdgeIds,
    toggleNodeFromTarget: (targetId, toggle) => {
      queueMicrotask(() => {
        const currentSelection = getCanvasSelectionSnapshot()
        const nextIds = getNextSelectedIds({
          selectedIds: currentSelection.nodeIds,
          targetId,
          toggle,
        })
        replaceCanvasSelection(reactFlow, {
          nodeIds: nextIds,
          edgeIds: toggle ? currentSelection.edgeIds : [],
        })
      })
    },
    toggleEdgeFromTarget: (targetId, toggle) => {
      queueMicrotask(() => {
        const currentSelection = getCanvasSelectionSnapshot()
        const nextIds = getNextSelectedIds({
          selectedIds: currentSelection.edgeIds,
          targetId,
          toggle,
        })
        replaceCanvasSelection(reactFlow, {
          nodeIds: toggle ? currentSelection.nodeIds : [],
          edgeIds: nextIds,
        })
      })
    },
    beginGesture: (kind) => {
      useCanvasSelectionState.getState().beginGesture(kind)
    },
    commitGestureSelection: (selection, mode = 'replace') => {
      replaceCanvasSelection(
        reactFlow,
        applyCanvasSelectionCommitMode({
          currentSelection: getCanvasSelectionSnapshot(),
          nextSelection: selection,
          mode,
        }),
      )
    },
    endGesture: () => {
      useCanvasSelectionState.getState().endGesture()
    },
  }
}
