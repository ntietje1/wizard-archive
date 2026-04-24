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
  setLocalSelection?: (nodeIds: ReadonlySet<string> | null) => void
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

function hasSameIds(nextIds: ReadonlySet<string>, prevIds: ReadonlySet<string>) {
  if (nextIds.size !== prevIds.size) {
    return false
  }

  for (const id of nextIds) {
    if (!prevIds.has(id)) {
      return false
    }
  }
  return true
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
  reactFlow.setNodes((nodes) =>
    nodes.map((node) => {
      const selected = selection.nodeIds.has(node.id)
      const draggable = selected
      if (node.selected === selected && (node.draggable ?? false) === draggable) {
        return node
      }

      return { ...node, selected, draggable }
    }),
  )
  reactFlow.setEdges?.((edges) =>
    edges.map((edge) => {
      const selected = selection.edgeIds.has(edge.id)
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
  setLocalSelection: (nodeIds: ReadonlySet<string> | null) => void
}): CanvasSelectionController {
  const applySelection = (selection: CanvasSelectionSnapshot) => {
    const prevSelection = getCanvasSelectionSnapshot()

    if (hasSameSelection(selection, prevSelection)) {
      return
    }

    projectCanvasSelectionToReactFlow(getReactFlow(), selection)
    useCanvasSelectionState.getState().setSelection(selection)
    setLocalSelection(selection.nodeIds.size > 0 ? selection.nodeIds : null)
    onSelectionChange(selection)
  }

  return {
    getSnapshot: () => getCanvasSelectionSnapshot(),
    replace: (selection) => {
      applySelection(selection)
    },
    replaceNodes: (nodeIds) => {
      applySelection({ nodeIds, edgeIds: new Set() })
    },
    replaceEdges: (edgeIds) => {
      applySelection({ nodeIds: new Set(), edgeIds })
    },
    clear: () => {
      applySelection({ nodeIds: new Set(), edgeIds: new Set() })
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
        edgeIds: toggle ? currentSelection.edgeIds : new Set(),
      })
    },
    toggleEdgeFromTarget: (targetId, toggle) => {
      const currentSelection = getCanvasSelectionSnapshot()
      applySelection({
        nodeIds: toggle ? currentSelection.nodeIds : new Set(),
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
