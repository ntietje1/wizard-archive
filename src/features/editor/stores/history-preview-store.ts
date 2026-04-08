import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'

interface HistoryPreviewState {
  previewingEntryId: Id<'editHistory'> | null
}

interface HistoryPreviewActions {
  setPreviewingEntry: (id: Id<'editHistory'> | null) => void
  clearPreview: () => void
}

export const useHistoryPreviewStore = create<
  HistoryPreviewState & HistoryPreviewActions
>((set) => ({
  previewingEntryId: null,

  setPreviewingEntry: (id) => set({ previewingEntryId: id }),
  clearPreview: () => set({ previewingEntryId: null }),
}))

export const selectPreviewingEntryId = (
  s: HistoryPreviewState,
): Id<'editHistory'> | null => s.previewingEntryId
