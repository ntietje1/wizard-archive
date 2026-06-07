import { create } from 'zustand'
import type { Id } from 'convex/_generated/dataModel'

interface HistoryPreviewSession {
  itemId: Id<'sidebarItems'>
  entryId: Id<'editHistory'>
}

interface HistoryPreviewState {
  preview: HistoryPreviewSession | null
  rollback: HistoryPreviewSession | null
}

interface HistoryPreviewActions {
  setPreviewingEntry: (itemId: Id<'sidebarItems'>, entryId: Id<'editHistory'> | null) => void
  clearPreview: (itemId?: Id<'sidebarItems'>) => void
  setRollbackEntry: (itemId: Id<'sidebarItems'>, entryId: Id<'editHistory'> | null) => void
  clearRollback: (itemId?: Id<'sidebarItems'>) => void
  clearItemSession: (itemId: Id<'sidebarItems'>) => void
}

export const useHistoryPreviewStore = create<HistoryPreviewState & HistoryPreviewActions>(
  (set) => ({
    preview: null,
    rollback: null,

    setPreviewingEntry: (itemId, entryId) =>
      set((prev) => ({
        preview: entryId
          ? { itemId, entryId }
          : prev.preview?.itemId === itemId
            ? null
            : prev.preview,
      })),
    clearPreview: (itemId) =>
      set((prev) => ({
        preview: !itemId || prev.preview?.itemId === itemId ? null : prev.preview,
      })),
    setRollbackEntry: (itemId, entryId) =>
      set((prev) => ({
        rollback: entryId
          ? { itemId, entryId }
          : prev.rollback?.itemId === itemId
            ? null
            : prev.rollback,
      })),
    clearRollback: (itemId) =>
      set((prev) => ({
        rollback: !itemId || prev.rollback?.itemId === itemId ? null : prev.rollback,
      })),
    clearItemSession: (itemId) =>
      set((prev) => ({
        preview: prev.preview?.itemId === itemId ? null : prev.preview,
        rollback: prev.rollback?.itemId === itemId ? null : prev.rollback,
      })),
  }),
)
