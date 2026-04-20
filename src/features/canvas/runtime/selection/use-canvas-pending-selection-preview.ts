import { create } from 'zustand'

interface CanvasPendingSelectionPreviewState {
  pendingNodeIds: Set<string> | null
  pendingEdgeIds: Set<string>
}

interface CanvasPendingSelectionPreviewActions {
  setPendingSelection: (preview: { nodeIds: Set<string>; edgeIds: Set<string> } | null) => void
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
  pendingEdgeIds: new Set(),
  setPendingSelection: (preview) =>
    set((state) =>
      preview === null
        ? state.pendingNodeIds === null && state.pendingEdgeIds.size === 0
          ? state
          : { pendingNodeIds: null, pendingEdgeIds: new Set() }
        : areStringSetsEqual(state.pendingNodeIds, preview.nodeIds) &&
            areStringSetsEqual(state.pendingEdgeIds, preview.edgeIds)
          ? state
          : {
              pendingNodeIds: preview.nodeIds,
              pendingEdgeIds: preview.edgeIds,
            },
    ),
  reset: () =>
    set((state) =>
      state.pendingNodeIds === null && state.pendingEdgeIds.size === 0
        ? state
        : { pendingNodeIds: null, pendingEdgeIds: new Set() },
    ),
}))

export function setCanvasPendingSelectionPreview(
  preview: { nodeIds: Iterable<string>; edgeIds?: Iterable<string> } | null,
) {
  useCanvasPendingSelectionPreviewStore.getState().setPendingSelection(
    preview === null
      ? null
      : {
          nodeIds: new Set(preview.nodeIds),
          edgeIds: new Set(preview.edgeIds ?? []),
        },
  )
}

export function clearCanvasPendingSelectionPreview() {
  useCanvasPendingSelectionPreviewStore.getState().reset()
}
