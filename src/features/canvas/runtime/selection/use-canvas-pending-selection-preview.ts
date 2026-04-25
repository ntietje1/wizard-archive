import {
  getCanvasPendingSelectionPreviewSummary,
  isCanvasPendingPreviewActive,
} from '../../system/canvas-selection'
import type { CanvasPendingSelectionPreview } from '../../system/canvas-selection'
import { useCanvasEngineSelector } from '../../react/use-canvas-engine'

type PendingSelectionPreviewSummary = {
  active: boolean
  nodeCount: number
  edgeCount: number
}

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

export function useCanvasPendingPreviewActive() {
  return useCanvasEngineSelector((state) =>
    isCanvasPendingPreviewActive(state.selection.pendingPreview),
  )
}

export function useCanvasNodePendingPreview(id: string) {
  return useCanvasEngineSelector((state) => {
    const preview = state.selection.pendingPreview
    return preview.kind === 'active' && preview.nodeIds.has(id)
  })
}

export function useCanvasEdgePendingPreview(id: string) {
  return useCanvasEngineSelector((state) => {
    const preview = state.selection.pendingPreview
    return preview.kind === 'active' && preview.edgeIds.has(id)
  })
}

export function useCanvasPendingSelectionPreviewSummary() {
  return useCanvasEngineSelector(
    (state) => getCanvasPendingSelectionPreviewSummary(state.selection.pendingPreview),
    arePreviewSummariesEqual,
  )
}

export type { CanvasPendingSelectionPreview }
