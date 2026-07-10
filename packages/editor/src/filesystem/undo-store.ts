import { create } from 'zustand'
import type { StoreApi, UseBoundStore } from 'zustand'
import type { FileSystemTransactionId } from '../../../../shared/common/ids'
import type { ResourceTransactionReceipt } from './transaction-contract'
import { shouldRecordFileSystemUndo } from './undo-recording'

const MAX_FILE_SYSTEM_HISTORY = 50
const historyEntryWorkspaceRevision: unique symbol = Symbol('historyEntryWorkspaceRevision')

export type FileSystemHistoryEntry = {
  workspaceId: string
  transactionId: FileSystemTransactionId
  replayFingerprint?: string
  [historyEntryWorkspaceRevision]?: number
}

type FileSystemUndoState = {
  workspaceId: string | null
  workspaceRevision: number
  undoStack: Array<FileSystemHistoryEntry>
  redoStack: Array<FileSystemHistoryEntry>
  setWorkspace: (workspaceId: string | null) => void
  reset: () => void
  pushUndo: (
    workspaceId: string,
    receipt: ResourceTransactionReceipt,
    options?: { preserveRedo?: boolean; replayFingerprint?: string },
  ) => void
  pushUndoEntry: (entry: FileSystemHistoryEntry, options?: { preserveRedo?: boolean }) => void
  isCurrentEntry: (entry: FileSystemHistoryEntry) => boolean
  peekUndo: () => FileSystemHistoryEntry | null
  removeUndo: () => void
  removeUndoTransaction: (workspaceId: string, transactionId: FileSystemTransactionId) => void
  pushRedoEntry: (entry: FileSystemHistoryEntry) => void
  peekRedo: () => FileSystemHistoryEntry | null
  removeRedo: () => void
  clearRedo: () => void
}

export type FileSystemUndoStore = UseBoundStore<StoreApi<FileSystemUndoState>>

function createFileSystemHistoryEntry(
  workspaceId: string,
  transactionId: FileSystemTransactionId,
  workspaceRevision: number,
  replayFingerprint?: string,
): FileSystemHistoryEntry {
  const entry: FileSystemHistoryEntry = {
    workspaceId,
    transactionId,
    ...(replayFingerprint === undefined ? {} : { replayFingerprint }),
  }
  Object.defineProperty(entry, historyEntryWorkspaceRevision, {
    value: workspaceRevision,
  })
  return entry
}

export function withFileSystemHistoryReplayFingerprint(
  entry: FileSystemHistoryEntry,
  replayFingerprint: string,
): FileSystemHistoryEntry {
  const next: FileSystemHistoryEntry = { ...entry, replayFingerprint }
  const workspaceRevision = entry[historyEntryWorkspaceRevision]
  if (workspaceRevision !== undefined) {
    Object.defineProperty(next, historyEntryWorkspaceRevision, {
      value: workspaceRevision,
    })
  }
  return next
}

function isCurrentWorkspaceHistoryEntry(state: FileSystemUndoState, entry: FileSystemHistoryEntry) {
  return (
    state.workspaceId === entry.workspaceId &&
    entry[historyEntryWorkspaceRevision] === state.workspaceRevision
  )
}

export function createFileSystemUndoStore(): FileSystemUndoStore {
  return create<FileSystemUndoState>((set, get) => ({
    workspaceId: null,
    workspaceRevision: 0,
    undoStack: [],
    redoStack: [],
    setWorkspace: (workspaceId) =>
      set((state) => {
        if (state.workspaceId === workspaceId) return state
        return {
          workspaceId,
          workspaceRevision: state.workspaceRevision + 1,
          undoStack: [],
          redoStack: [],
        }
      }),
    reset: () =>
      set((state) => ({
        workspaceId: null,
        workspaceRevision: state.workspaceRevision + 1,
        undoStack: [],
        redoStack: [],
      })),
    pushUndo: (workspaceId, receipt, options) =>
      set((state) => {
        return state.workspaceId !== workspaceId || !shouldRecordFileSystemUndo(receipt)
          ? state
          : {
              undoStack: [
                ...state.undoStack,
                createFileSystemHistoryEntry(
                  workspaceId,
                  receipt.transactionId,
                  state.workspaceRevision,
                  options?.replayFingerprint,
                ),
              ].slice(-MAX_FILE_SYSTEM_HISTORY),
              redoStack: options?.preserveRedo ? state.redoStack : [],
            }
      }),
    pushUndoEntry: (entry, options) =>
      set((state) =>
        !isCurrentWorkspaceHistoryEntry(state, entry)
          ? state
          : {
              undoStack: [...state.undoStack, entry].slice(-MAX_FILE_SYSTEM_HISTORY),
              redoStack: options?.preserveRedo ? state.redoStack : [],
            },
      ),
    isCurrentEntry: (entry) => isCurrentWorkspaceHistoryEntry(get(), entry),
    peekUndo: () => get().undoStack.at(-1) ?? null,
    removeUndo: () => {
      const stack = get().undoStack
      if (stack.length === 0) return
      set({ undoStack: stack.slice(0, -1) })
    },
    removeUndoTransaction: (workspaceId, transactionId) =>
      set((state) =>
        state.workspaceId !== workspaceId
          ? state
          : {
              undoStack: state.undoStack.filter((entry) => entry.transactionId !== transactionId),
            },
      ),
    pushRedoEntry: (entry) =>
      set((state) =>
        !isCurrentWorkspaceHistoryEntry(state, entry)
          ? state
          : {
              redoStack: [...state.redoStack, entry].slice(-MAX_FILE_SYSTEM_HISTORY),
            },
      ),
    peekRedo: () => get().redoStack.at(-1) ?? null,
    removeRedo: () => {
      const stack = get().redoStack
      if (stack.length === 0) return
      set({ redoStack: stack.slice(0, -1) })
    },
    clearRedo: () => set({ redoStack: [] }),
  }))
}
