import { getCanvasVisualSelectionState } from '../../runtime/selection/canvas-visual-selection'
import {
  useCanvasNodePendingPreview,
  useCanvasPendingPreviewActive,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'

export function useCanvasNodeVisualSelection(id: string) {
  const selected = useIsCanvasNodeSelected(id)
  const pendingPreviewActive = useCanvasPendingPreviewActive()
  const pendingSelected = useCanvasNodePendingPreview(id)

  return getCanvasVisualSelectionState({
    selected,
    pendingPreviewActive,
    pendingSelected,
  })
}
