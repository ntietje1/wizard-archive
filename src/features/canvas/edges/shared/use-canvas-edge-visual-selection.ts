import { getCanvasVisualSelectionState } from '../../runtime/selection/canvas-visual-selection'
import {
  useCanvasEdgePendingPreview,
  useCanvasPendingPreviewActive,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasEdgeSelected } from '../../runtime/selection/use-canvas-selection-state'

export function useCanvasEdgeVisualSelection(id: string) {
  const selected = useIsCanvasEdgeSelected(id)
  const pendingPreviewActive = useCanvasPendingPreviewActive()
  const pendingSelected = useCanvasEdgePendingPreview(id)

  return getCanvasVisualSelectionState({
    selected,
    pendingPreviewActive,
    pendingSelected,
  })
}
