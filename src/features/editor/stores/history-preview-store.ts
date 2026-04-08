import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'

interface HistoryPreviewState {
  previewingEntryId: Id<'editHistory'> | null
  rollbackEntryId: Id<'editHistory'> | null
}

interface HistoryPreviewActions {
  setPreviewingEntry: (id: Id<'editHistory'> | null) => void
  clearPreview: () => void
  setRollbackEntryId: (id: Id<'editHistory'> | null) => void
}

export const useHistoryPreviewStore = create<
  HistoryPreviewState & HistoryPreviewActions
>((set) => ({
  previewingEntryId: null,
  rollbackEntryId: null,

  setPreviewingEntry: (id) => set({ previewingEntryId: id }),
  clearPreview: () => set({ previewingEntryId: null }),
  setRollbackEntryId: (id) => set({ rollbackEntryId: id }),
}))

export const selectPreviewingEntryId = (
  s: HistoryPreviewState,
): Id<'editHistory'> | null => s.previewingEntryId
