import { create } from 'zustand'
import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
  SidebarItemFieldPatch,
} from 'convex/sidebarItems/filesystem/receipts'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { logger } from '~/shared/utils/logger'

const MAX_FILE_SYSTEM_HISTORY = 50

function tryInvertReceiptPatches(
  receipt: FileSystemTransactionReceipt,
): Array<FileSystemPatch> | null {
  try {
    return invertReceiptPatchesForUndo(receipt.patches)
  } catch (error) {
    logger.error('Failed to invert filesystem patches', error)
    return null
  }
}

function undoHiddenFields(): SidebarItemFieldPatch {
  return {
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    status: SIDEBAR_ITEM_STATUS.undoHidden,
    deletionTime: null,
    deletedBy: null,
  }
}

function invertReceiptPatchesForUndo(patches: Array<FileSystemPatch>): Array<FileSystemPatch> {
  return patches.map((patch): FileSystemPatch => {
    if (patch.type === 'upsertSidebarItem') {
      const hidden = undoHiddenFields()
      return {
        type: 'updateSidebarItem',
        itemId: patch.item._id,
        before: {
          location: patch.item.location,
          status: patch.item.status,
          deletionTime: patch.item.deletionTime,
          deletedBy: patch.item.deletedBy,
        },
        fields: hidden,
      }
    }
    if (patch.type === 'removeSidebarItem') {
      if (!patch.snapshot) {
        throw new Error(`Cannot invert remove patch without a snapshot for ${patch.itemId}`)
      }
      return { type: 'upsertSidebarItem', item: patch.snapshot }
    }
    return {
      type: 'updateSidebarItem',
      itemId: patch.itemId,
      before: patch.fields,
      fields: patch.before,
    }
  })
}

type FileSystemHistoryEntry = {
  transactionId: Id<'filesystemTransactions'>
  summary: FileSystemTransactionReceipt['summary']
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
      const inversePatches = tryInvertReceiptPatches(receipt)
      return receipt.transactionId === null || !inversePatches
        ? state
        : {
            undoStack: [
              ...state.undoStack,
              {
                transactionId: receipt.transactionId,
                summary: receipt.summary,
                forwardPatches: receipt.patches,
                inversePatches,
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
