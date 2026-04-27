import { getCanvasPendingSelectionPreviewSummary } from '../../system/canvas-selection'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'

type PendingSelectionPreviewSummary = ReturnType<typeof getCanvasPendingSelectionPreviewSummary>

function arePreviewSummariesEqual(
  left: PendingSelectionPreviewSummary,
  right: PendingSelectionPreviewSummary,
) {
  return (
    left.active === right.active &&
    left.nodeCount === right.nodeCount &&
    left.edgeCount === right.edgeCount
  )
}

export function useCanvasPendingSelectionPreviewSummary() {
  return useCanvasEngineSelector(
    (state) => getCanvasPendingSelectionPreviewSummary(state.selection.pendingPreview),
    arePreviewSummariesEqual,
  )
}
