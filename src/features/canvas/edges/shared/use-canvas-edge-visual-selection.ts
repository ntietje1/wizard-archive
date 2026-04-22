import { getCanvasVisualSelectionState } from '../../runtime/selection/canvas-visual-selection'
import {
  useCanvasEdgePendingPreview,
  useCanvasPendingPreviewActive,
} from '../../runtime/selection/use-canvas-pending-selection-preview'
import { useIsCanvasEdgeSelected } from '../../runtime/selection/use-canvas-selection-state'
import { useIsInteractiveCanvasRenderMode } from '../../runtime/providers/use-canvas-render-mode'

export function useCanvasEdgeVisualSelection(id: string) {
  const interactiveRenderMode = useIsInteractiveCanvasRenderMode()
  const selected = useIsCanvasEdgeSelected(id)
  const pendingPreviewActive = useCanvasPendingPreviewActive()
  const pendingSelected = useCanvasEdgePendingPreview(id)

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
