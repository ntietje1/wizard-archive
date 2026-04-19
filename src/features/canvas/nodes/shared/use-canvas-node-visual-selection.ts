import { useShallow } from 'zustand/shallow'
import { useCanvasPendingSelectionPreviewStore } from '../../runtime/selection/use-canvas-pending-selection-preview'

export function useCanvasNodeVisualSelection(id: string, selected: boolean) {
  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => {
      const pendingNodeIds = state.pendingNodeIds
      const pendingPreviewActive = pendingNodeIds !== null

      return {
        pendingPreviewActive,
        visuallySelected: pendingPreviewActive ? pendingNodeIds.has(id) : selected,
      }
    }),
  )
}
