import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'

export interface HistoryPreviewState {
  previewingEntryId: Id<'editHistory'> | null
  rollbackEntryId: Id<'editHistory'> | null
}

export interface HistoryPreviewActions {
  setPreviewingEntry: (id: Id<'editHistory'> | null) => void
  clearPreview: () => void
  setRollbackEntryId: (id: Id<'editHistory'> | null) => void
  clearRollbackEntryId: () => void
}

export const useHistoryPreviewStore = create<
  HistoryPreviewState & HistoryPreviewActions
>((set) => ({
  previewingEntryId: null,
  rollbackEntryId: null,

  setPreviewingEntry: (id) => set({ previewingEntryId: id }),
  clearPreview: () => set({ previewingEntryId: null }),
  setRollbackEntryId: (id) => set({ rollbackEntryId: id }),
  clearRollbackEntryId: () => set({ rollbackEntryId: null }),
}))

export const selectPreviewingEntryId = (
  s: HistoryPreviewState,
): Id<'editHistory'> | null => s.previewingEntryId

export const selectRollbackEntryId = (
  s: HistoryPreviewState,
): Id<'editHistory'> | null => s.rollbackEntryId
