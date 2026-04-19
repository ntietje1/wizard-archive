import { create } from 'zustand'

interface CanvasPendingSelectionPreviewState {
  pendingNodeIds: Set<string> | null
}

interface CanvasPendingSelectionPreviewActions {
  setPendingNodeIds: (nodeIds: Set<string> | null) => void
  reset: () => void
}

function areStringSetsEqual(a: Set<string> | null, b: Set<string> | null): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.size !== b.size) return false

  for (const value of a) {
    if (!b.has(value)) return false
  }

  return true
}

export const useCanvasPendingSelectionPreviewStore = create<
  CanvasPendingSelectionPreviewState & CanvasPendingSelectionPreviewActions
>((set) => ({
  pendingNodeIds: null,
  setPendingNodeIds: (pendingNodeIds) =>
    set((state) =>
      areStringSetsEqual(state.pendingNodeIds, pendingNodeIds) ? state : { pendingNodeIds },
    ),
  reset: () => set((state) => (state.pendingNodeIds === null ? state : { pendingNodeIds: null })),
}))

export function setCanvasPendingSelectionPreview(nodeIds: Iterable<string> | null) {
  useCanvasPendingSelectionPreviewStore
    .getState()
    .setPendingNodeIds(nodeIds === null ? null : new Set(nodeIds))
}

export function clearCanvasPendingSelectionPreview() {
  useCanvasPendingSelectionPreviewStore.getState().reset()
}
