import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import { setCanvasSelection } from './canvas-selection-projection'
import { useCanvasSelectionState } from './useCanvasSelectionState'
import type { CanvasDocumentReader, CanvasSelectionActions } from '../tools/canvas-tool-types'

export function useCanvasSelectionActions(): CanvasSelectionActions & CanvasDocumentReader {
  const reactFlow = useReactFlow()

  return useMemo(
    () => ({
      setNodeSelection: (nodeIds) => {
        setCanvasSelection(reactFlow, nodeIds)
      },
      clearSelection: () => {
        setCanvasSelection(reactFlow, [])
      },
      getSelectedNodeIds: () => useCanvasSelectionState.getState().selectedNodeIds,
      getNodes: () => reactFlow.getNodes(),
      getEdges: () => reactFlow.getEdges(),
    }),
    [reactFlow],
  )
}
