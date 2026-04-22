import { getCanvasVisualSelectionState } from '../../runtime/selection/canvas-visual-selection'
import {
  useCanvasNodePendingPreview,
  useCanvasPendingPreviewActive,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasNodeSelected } from '../../runtime/selection/use-canvas-selection-state'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'

export function useCanvasNodeVisualSelection(id: string) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const selected = useIsCanvasNodeSelected(id)
  const pendingPreviewActive = useCanvasPendingPreviewActive()
  const pendingSelected = useCanvasNodePendingPreview(id)

  if (!interactiveRenderMode) {
    return getCanvasVisualSelectionState({
      selected: false,
      pendingPreviewActive: false,
      pendingSelected: false,
    })
  }

  return getCanvasVisualSelectionState({
    selected,
    pendingPreviewActive,
    pendingSelected,
  })
}
