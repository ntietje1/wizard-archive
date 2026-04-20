import { useShallow } from 'zustand/shallow'
import { useCanvasPendingSelectionPreviewStore } from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'

export function useCanvasNodeVisualSelection(id: string) {
  const selected = useIsCanvasNodeSelected(id)

  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => {
      const pendingNodeIds = state.pendingNodeIds
      const pendingPreviewActive = pendingNodeIds !== null
      const pendingSelected = pendingPreviewActive && pendingNodeIds.has(id)

      return {
        selected,
        pendingPreviewActive,
        pendingSelected,
        visuallySelected: pendingPreviewActive ? pendingSelected : selected,
      }
    }),
  )
}
