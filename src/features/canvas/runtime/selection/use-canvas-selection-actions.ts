import { useReactFlow } from '@xyflow/react'
import { setCanvasSelection } from './canvas-selection-projection'
import { useCanvasSelectionState } from './use-canvas-selection-state'
import type { CanvasSelectionActions } from '../../tools/canvas-tool-types'

export function useCanvasSelectionActions(): CanvasSelectionActions {
  const reactFlow = useReactFlow()

  return {
    setNodeSelection: (nodeIds) => {
      setCanvasSelection(reactFlow, nodeIds)
    },
    clearSelection: () => {
      setCanvasSelection(reactFlow, [])
    },
    getSelectedNodeIds: () => useCanvasSelectionState.getState().selectedNodeIds,
  }
}
