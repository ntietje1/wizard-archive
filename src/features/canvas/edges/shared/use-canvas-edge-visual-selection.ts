import { useShallow } from 'zustand/shallow'
import { useCanvasPendingSelectionPreviewStore } from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasEdgeSelected } from '../../runtime/selection/use-canvas-selection-state'

export function useCanvasEdgeVisualSelection(id: string) {
  const selected = useIsCanvasEdgeSelected(id)

  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => {
      const pendingPreviewActive = state.pendingNodeIds !== null
      const pendingSelected = pendingPreviewActive && state.pendingEdgeIds.has(id)

      return {
        selected,
        pendingPreviewActive,
        pendingSelected,
        visuallySelected: pendingPreviewActive ? pendingSelected : selected,
      }
    }),
  )
}
