import { create } from 'zustand'

interface CanvasPendingSelectionPreviewState {
  // `null` means no preview is active; edges stay as an empty Set when a preview has no edge hits.
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

function getNextPendingSelectionState(
  state: CanvasPendingSelectionPreviewState,
  preview: { nodeIds: Set<string>; edgeIds: Set<string> } | null,
) {
  if (preview === null) {
    return state.pendingNodeIds === null && state.pendingEdgeIds.size === 0
      ? state
      : { pendingNodeIds: null, pendingEdgeIds: new Set<string>() }
  }

  return areStringSetsEqual(state.pendingNodeIds, preview.nodeIds) &&
    areStringSetsEqual(state.pendingEdgeIds, preview.edgeIds)
    ? state
    : {
        pendingNodeIds: preview.nodeIds,
        pendingEdgeIds: preview.edgeIds,
      }
}

export const useCanvasPendingSelectionPreviewStore = create<
  CanvasPendingSelectionPreviewState & CanvasPendingSelectionPreviewActions
>((set) => ({
  pendingNodeIds: null,
  pendingEdgeIds: new Set(),
  setPendingSelection: (preview) => set((state) => getNextPendingSelectionState(state, preview)),
  reset: () => set((state) => getNextPendingSelectionState(state, null)),
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
