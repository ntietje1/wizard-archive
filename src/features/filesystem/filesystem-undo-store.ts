import { create } from 'zustand'
import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import type { Id } from 'convex/_generated/dataModel'

const MAX_FILE_SYSTEM_HISTORY = 50

type FileSystemHistoryEntry = {
  transactionId: Id<'filesystemTransactions'>
  forwardPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
}

type FileSystemUndoState = {
  campaignId: Id<'campaigns'> | null
  undoStack: Array<FileSystemHistoryEntry>
  redoStack: Array<FileSystemHistoryEntry>
  setCampaign: (campaignId: Id<'campaigns'> | null) => void
  reset: () => void
  pushUndo: (receipt: FileSystemTransactionReceipt, options?: { preserveRedo?: boolean }) => void
  pushUndoEntry: (entry: FileSystemHistoryEntry, options?: { preserveRedo?: boolean }) => void
  peekUndo: () => FileSystemHistoryEntry | null
  removeUndo: () => void
  pushRedoEntry: (entry: FileSystemHistoryEntry) => void
  peekRedo: () => FileSystemHistoryEntry | null
  removeRedo: () => void
  clearRedo: () => void
}

export function shouldRecordFileSystemUndo(
  receipt: Pick<FileSystemTransactionReceipt, 'transactionId' | 'undoable'>,
) {
  return receipt.undoable && receipt.transactionId !== null
}

export const useFileSystemUndoStore = create<FileSystemUndoState>((set, get) => ({
  campaignId: null,
  undoStack: [],
  redoStack: [],
  setCampaign: (campaignId) =>
    set((state) => {
      if (state.campaignId === campaignId) return state
      return { campaignId, undoStack: [], redoStack: [] }
    }),
  reset: () => set({ campaignId: null, undoStack: [], redoStack: [] }),
  pushUndo: (receipt, options) =>
    set((state) => {
      return receipt.transactionId === null ||
        !receipt.undoable ||
        receipt.inversePatches.length === 0
        ? state
        : {
            undoStack: [
              ...state.undoStack,
              {
                transactionId: receipt.transactionId,
                forwardPatches: receipt.forwardPatches,
                inversePatches: receipt.inversePatches,
              },
            ].slice(-MAX_FILE_SYSTEM_HISTORY),
            redoStack: options?.preserveRedo ? state.redoStack : [],
          }
    }),
  pushUndoEntry: (entry, options) =>
    set((state) => ({
      undoStack: [...state.undoStack, entry].slice(-MAX_FILE_SYSTEM_HISTORY),
      redoStack: options?.preserveRedo ? state.redoStack : [],
    })),
  peekUndo: () => get().undoStack.at(-1) ?? null,
  removeUndo: () => {
    const stack = get().undoStack
    if (stack.length === 0) return
    set({ undoStack: stack.slice(0, -1) })
  },
  pushRedoEntry: (entry) =>
    set((state) => ({
      redoStack: [...state.redoStack, entry].slice(-MAX_FILE_SYSTEM_HISTORY),
    })),
  peekRedo: () => get().redoStack.at(-1) ?? null,
  removeRedo: () => {
    const stack = get().redoStack
    if (stack.length === 0) return
    set({ redoStack: stack.slice(0, -1) })
  },
  clearRedo: () => set({ redoStack: [] }),
}))
