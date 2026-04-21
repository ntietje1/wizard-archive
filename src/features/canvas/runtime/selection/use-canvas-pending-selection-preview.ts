import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import {
  createCanvasPendingSelectionPreview,
  createInactiveCanvasPendingSelectionPreview,
  getCanvasPendingSelectionPreviewSummary,
  getNextCanvasPendingSelectionPreview,
  isCanvasEdgePendingPreview,
  isCanvasNodePendingPreview,
  isCanvasPendingPreviewActive,
} from './canvas-pending-selection-preview-state'
import type { CanvasPendingSelectionPreview } from './canvas-pending-selection-preview-state'

interface CanvasPendingSelectionPreviewState {
  preview: CanvasPendingSelectionPreview
}

interface CanvasPendingSelectionPreviewActions {
  setPendingSelection: (preview: CanvasPendingSelectionPreview) => void
  reset: () => void
}

const useCanvasPendingSelectionPreviewStore = create<
  CanvasPendingSelectionPreviewState & CanvasPendingSelectionPreviewActions
>((set) => ({
  preview: createInactiveCanvasPendingSelectionPreview(),
  setPendingSelection: (preview) =>
    set((state) => {
      const nextPreview = getNextCanvasPendingSelectionPreview(state.preview, preview)
      return nextPreview === state.preview ? state : { preview: nextPreview }
    }),
  reset: () =>
    set((state) => {
      const nextPreview = getNextCanvasPendingSelectionPreview(
        state.preview,
        createInactiveCanvasPendingSelectionPreview(),
      )
      return nextPreview === state.preview ? state : { preview: nextPreview }
    }),
}))

export function setCanvasPendingSelectionPreview(
  preview: { nodeIds: Iterable<string>; edgeIds?: Iterable<string> } | null,
) {
  useCanvasPendingSelectionPreviewStore
    .getState()
    .setPendingSelection(createCanvasPendingSelectionPreview(preview))
}

export function clearCanvasPendingSelectionPreview() {
  useCanvasPendingSelectionPreviewStore.getState().reset()
}

export function getCanvasPendingSelectionPreview() {
  return useCanvasPendingSelectionPreviewStore.getState().preview
}

export function useCanvasPendingPreviewActive() {
  return useCanvasPendingSelectionPreviewStore((state) =>
    isCanvasPendingPreviewActive(state.preview),
  )
}

export function useCanvasNodePendingPreview(id: string) {
  return useCanvasPendingSelectionPreviewStore((state) =>
    isCanvasNodePendingPreview(state.preview, id),
  )
}

export function useCanvasEdgePendingPreview(id: string) {
  return useCanvasPendingSelectionPreviewStore((state) =>
    isCanvasEdgePendingPreview(state.preview, id),
  )
}

export function useCanvasPendingSelectionPreviewSummary() {
  return useCanvasPendingSelectionPreviewStore(
    useShallow((state) => getCanvasPendingSelectionPreviewSummary(state.preview)),
  )
}
