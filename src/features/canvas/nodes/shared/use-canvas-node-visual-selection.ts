import { useShallow } from 'zustand/shallow'
import { useCanvasPendingSelectionPreviewStore } from '../../runtime/selection/use-canvas-pending-selection-preview'

export function useCanvasNodeVisualSelection(id: string, selected: boolean) {
  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => {
      const pendingNodeIds = state.pendingNodeIds
      const pendingPreviewActive = pendingNodeIds !== null
      const pendingSelected = pendingPreviewActive && pendingNodeIds.has(id)

      return {
        pendingPreviewActive,
        pendingSelected,
        visuallySelected: pendingPreviewActive ? pendingSelected : selected,
      }
    }),
  )
}
