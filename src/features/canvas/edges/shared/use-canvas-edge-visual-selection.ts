import { useShallow } from 'zustand/shallow'
import { useCanvasPendingSelectionPreviewStore } from '../../runtime/selection/use-canvas-pending-selection-preview'

export function useCanvasEdgeVisualSelection(id: string, selected: boolean) {
  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => {
      const pendingPreviewActive = state.pendingNodeIds !== null
      const pendingSelected = pendingPreviewActive && state.pendingEdgeIds.has(id)

      return {
        pendingPreviewActive,
        pendingSelected,
        visuallySelected: pendingPreviewActive ? pendingSelected : selected,
      }
    }),
  )
}
