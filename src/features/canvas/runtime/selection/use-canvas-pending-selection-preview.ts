import { create } from 'zustand'

interface CanvasPendingSelectionPreviewState {
  pendingNodeIds: Set<string> | null
}

interface CanvasPendingSelectionPreviewActions {
  setPendingNodeIds: (nodeIds: Set<string> | null) => void
  reset: () => void
}

export const useCanvasPendingSelectionPreviewStore = create<
  CanvasPendingSelectionPreviewState & CanvasPendingSelectionPreviewActions
>((set) => ({
  pendingNodeIds: null,
  setPendingNodeIds: (pendingNodeIds) => set({ pendingNodeIds }),
  reset: () => set({ pendingNodeIds: null }),
}))

export function setCanvasPendingSelectionPreview(nodeIds: Iterable<string> | null) {
  useCanvasPendingSelectionPreviewStore
    .getState()
    .setPendingNodeIds(nodeIds === null ? null : new Set(nodeIds))
}

export function clearCanvasPendingSelectionPreview() {
  useCanvasPendingSelectionPreviewStore.getState().reset()
}
