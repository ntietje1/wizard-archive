import { useReactFlow } from '@xyflow/react'
import { useRef } from 'react'
import {
  applyCanvasSelectionCommitMode,
  getNextSelectedIds,
} from '../../utils/canvas-selection-utils'
import { useCanvasSelectionState } from './use-canvas-selection-state'
import type {
  CanvasSelectionController,
  CanvasSelectionSnapshot,
} from '../../tools/canvas-tool-types'
import type { ReactFlowInstance } from '@xyflow/react'

interface UseCanvasSelectionControllerOptions {
  onSelectionChange?: (selection: CanvasSelectionSnapshot) => void
  setLocalSelection?: (nodeIds: Array<string> | null) => void
}

type SelectionProjectionReactFlow = Pick<ReactFlowInstance, 'setNodes'> &
  Partial<Pick<ReactFlowInstance, 'setEdges'>>

function getCanvasSelectionSnapshot(): CanvasSelectionSnapshot {
  const state = useCanvasSelectionState.getState()
  return {
    nodeIds: state.selectedNodeIds,
    edgeIds: state.selectedEdgeIds,
  }
}

function hasSameIds(nextIds: Array<string>, prevIds: Array<string>) {
  if (nextIds.length !== prevIds.length) {
    return false
  }

  const prevIdSet = new Set(prevIds)
  return nextIds.every((id) => prevIdSet.has(id))
}

function hasSameSelection(
  nextSelection: CanvasSelectionSnapshot,
  prevSelection: CanvasSelectionSnapshot,
) {
  return (
    hasSameIds(nextSelection.nodeIds, prevSelection.nodeIds) &&
    hasSameIds(nextSelection.edgeIds, prevSelection.edgeIds)
  )
}

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

export function useCanvasSelectionController({
  onSelectionChange,
  setLocalSelection,
}: UseCanvasSelectionControllerOptions = {}): CanvasSelectionController {
  const reactFlow = useReactFlow()
  const reactFlowRef = useRef<SelectionProjectionReactFlow>(reactFlow)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const setLocalSelectionRef = useRef(setLocalSelection)
  reactFlowRef.current = reactFlow
  onSelectionChangeRef.current = onSelectionChange
  setLocalSelectionRef.current = setLocalSelection

  const controllerRef = useRef<CanvasSelectionController | null>(null)
  controllerRef.current ??= createCanvasSelectionController({
    getReactFlow: () => reactFlowRef.current,
    onSelectionChange: (selection) => onSelectionChangeRef.current?.(selection),
    setLocalSelection: (nodeIds) => setLocalSelectionRef.current?.(nodeIds),
  })

  return controllerRef.current
}

function createCanvasSelectionController({
  getReactFlow,
  onSelectionChange,
  setLocalSelection,
}: {
  getReactFlow: () => SelectionProjectionReactFlow
  onSelectionChange: (selection: CanvasSelectionSnapshot) => void
  setLocalSelection: (nodeIds: Array<string> | null) => void
}): CanvasSelectionController {
  const applySelection = (selection: CanvasSelectionSnapshot) => {
    const prevSelection = getCanvasSelectionSnapshot()

    if (hasSameSelection(selection, prevSelection)) {
      return
    }

    projectCanvasSelectionToReactFlow(getReactFlow(), selection)
    useCanvasSelectionState.getState().setSelection(selection)
    setLocalSelection(selection.nodeIds.length > 0 ? selection.nodeIds : null)
    onSelectionChange(selection)
  }

  return {
    getSnapshot: () => getCanvasSelectionSnapshot(),
    replace: (selection) => {
      applySelection(selection)
    },
    replaceNodes: (nodeIds) => {
      applySelection({ nodeIds, edgeIds: [] })
    },
    replaceEdges: (edgeIds) => {
      applySelection({ nodeIds: [], edgeIds })
    },
    clear: () => {
      applySelection({ nodeIds: [], edgeIds: [] })
    },
    getSelectedNodeIds: () => useCanvasSelectionState.getState().selectedNodeIds,
    getSelectedEdgeIds: () => useCanvasSelectionState.getState().selectedEdgeIds,
    toggleNodeFromTarget: (targetId, toggle) => {
      const currentSelection = getCanvasSelectionSnapshot()
      applySelection({
        nodeIds: getNextSelectedIds({
          selectedIds: currentSelection.nodeIds,
          targetId,
          toggle,
        }),
        edgeIds: toggle ? currentSelection.edgeIds : [],
      })
    },
    toggleEdgeFromTarget: (targetId, toggle) => {
      const currentSelection = getCanvasSelectionSnapshot()
      applySelection({
        nodeIds: toggle ? currentSelection.nodeIds : [],
        edgeIds: getNextSelectedIds({
          selectedIds: currentSelection.edgeIds,
          targetId,
          toggle,
        }),
      })
    },
    beginGesture: (kind) => {
      useCanvasSelectionState.getState().beginGesture(kind)
    },
    commitGestureSelection: (selection, mode = 'replace') => {
      applySelection(
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
