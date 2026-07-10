import type {
  FileSystemTransactionId,
  SidebarItemId,
  UserProfileId,
} from '../../../../shared/common/ids'
import type {
  ResourceCommand,
  ResourceCommandDecisionRecord,
  ResourceCommandExecutionOptions,
  ResourceCommandMutationInput,
  ResourceCommandResult,
  ResourceTransactionReceipt,
} from './transaction-contract'
import type { ItemOperationConflict } from './operation-planner'
import type { FileSystemLifecycleIntent } from './domain/lifecycle'
import type { AnyItem } from '../workspace/items'
import type { FileSystemCacheAdapter } from './cache'
import { executeFileSystemCommandLifecycle } from './command-lifecycle'
import { executeFileSystemHistoryLifecycle } from './history-lifecycle'
import { applyFileSystemLifecycleIntents } from './lifecycle-intents'
import { runFileSystemOptimisticMutation } from './optimistic-mutation'
import { applyFileSystemReceiptEffects } from './receipt-effects'
import { withFileSystemHistoryReplayFingerprint } from './undo-store'
import type { FileSystemUndoStore } from './undo-store'
import type { FileSystemExecutorEffects } from './executor-effects'

type ExecuteFileSystemHistoryMutation = (
  transactionId: FileSystemTransactionId,
) => Promise<ResourceTransactionReceipt>

type FileSystemNavigationEffects = {
  getCurrentResourceId: () => SidebarItemId | null
  clearWorkspaceContent: () => Promise<void>
  openResource: (
    resource: AnyItem,
    options?: { heading?: string; replace?: boolean },
  ) => Promise<void>
}

type FileSystemSelectionCommands = {
  clearItemSelection: () => void
  getSelectionSnapshot: () => { selectedItemIds: ReadonlyArray<SidebarItemId> }
  setSelectedItemIds: (itemIds: ReadonlyArray<SidebarItemId>, focusedItemId?: SidebarItemId) => void
}

type FileSystemUiCommands = {
  setFolderState: (folderId: SidebarItemId, isOpen: boolean) => void
}

export type FileSystemPendingConflict = {
  command: ResourceCommand
  createParentPlan?: ResourceCommandExecutionOptions['createParentPlan']
  conflicts: Array<ItemOperationConflict>
  replayFingerprint: string
  onSuccess?: () => void
}

type FileSystemExecutorSnapshot = {
  pendingOperationCount: number
  pendingConflict: FileSystemPendingConflict | null
}

export type FileSystemExecutorRuntimeArgs = {
  workspaceId: string
  currentUserId: UserProfileId | null
  activeItemSurface: { parentId: SidebarItemId | null } | null
  cacheAdapter: FileSystemCacheAdapter
  navigation: FileSystemNavigationEffects
  selectionCommands: FileSystemSelectionCommands
  uiCommands: FileSystemUiCommands
  executeMutation: (args: ResourceCommandMutationInput) => Promise<ResourceTransactionReceipt>
  undoMutation: ExecuteFileSystemHistoryMutation
  redoMutation: ExecuteFileSystemHistoryMutation
  undoStore: FileSystemUndoStore
  effects: FileSystemExecutorEffects
}

function createClientOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `filesystem-${Date.now()}-${Math.random()}`
}

function fingerprintFileSystemSnapshot(cacheAdapter: FileSystemCacheAdapter) {
  const snapshot = cacheAdapter.getSnapshot()
  return JSON.stringify(
    [...snapshot.sidebar, ...snapshot.trash]
      .map((item) => ({
        id: item.id,
        name: item.name,
        parentId: item.parentId,
        status: item.status,
        type: item.type,
      }))
      .sort((left, right) => String(left.id).localeCompare(String(right.id))),
  )
}

export function createFileSystemExecutorRuntime(initialArgs: FileSystemExecutorRuntimeArgs) {
  let args = initialArgs
  let mutationQueue: Promise<void> = Promise.resolve()
  let snapshot: FileSystemExecutorSnapshot = {
    pendingOperationCount: 0,
    pendingConflict: null,
  }
  const listeners = new Set<() => void>()

  const getSnapshot = () => snapshot
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  const updateSnapshot = (patch: Partial<FileSystemExecutorSnapshot>) => {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }
  const updateArgs = (nextArgs: FileSystemExecutorRuntimeArgs) => {
    args = nextArgs
  }

  const withPendingOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
    updateSnapshot({ pendingOperationCount: snapshot.pendingOperationCount + 1 })
    try {
      return await operation()
    } finally {
      updateSnapshot({ pendingOperationCount: Math.max(0, snapshot.pendingOperationCount - 1) })
    }
  }

  const runQueuedMutation = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation)
    mutationQueue = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const applyReceiptSideEffects = async (
    receipt: ResourceTransactionReceipt,
    currentResourceId = args.navigation.getCurrentResourceId(),
  ) => {
    await applyFileSystemReceiptEffects({
      receipt,
      readModel: args.cacheAdapter.getReadModel(),
      currentResourceId,
      getSelectedItemIds: () => args.selectionCommands.getSelectionSnapshot().selectedItemIds,
      setSelectedItemIds: args.selectionCommands.setSelectedItemIds,
      clearWorkspaceContent: args.navigation.clearWorkspaceContent,
      openResource: args.navigation.openResource,
      reportEffectError: args.effects.reportReceiptEffectError,
    })
  }

  const applyLifecycleIntents = (
    intents: Array<FileSystemLifecycleIntent>,
    previousResourceId: SidebarItemId | null,
  ) =>
    applyFileSystemLifecycleIntents({
      intents,
      previousResourceId,
      readModel: args.cacheAdapter.getReadModel(),
      adapters: {
        setFolderState: (_workspaceId, folderId, isOpen) =>
          args.uiCommands.setFolderState(folderId, isOpen),
        setSelectedItemIds: args.selectionCommands.setSelectedItemIds,
        getSelectionState: () => ({
          ...args.selectionCommands.getSelectionSnapshot(),
          clearItemSelection: args.selectionCommands.clearItemSelection,
        }),
        getCurrentResourceId: args.navigation.getCurrentResourceId,
        openResource: args.navigation.openResource,
        clearWorkspaceContent: args.navigation.clearWorkspaceContent,
      },
    })

  const executeCommand = async (
    command: ResourceCommand,
    { createParentPlan, decisions, onSuccess }: ResourceCommandExecutionOptions = {},
  ): Promise<ResourceCommandResult<ItemOperationConflict>> => {
    const result = await executeFileSystemCommandLifecycle({
      command,
      createParentPlan,
      decisions,
      workspaceId: args.workspaceId,
      currentUserId: args.currentUserId,
      activeItemSurface: args.activeItemSurface,
      cacheAdapter: args.cacheAdapter,
      createClientOperationId,
      getCurrentResourceId: args.navigation.getCurrentResourceId,
      runMutation: (operation) => withPendingOperation(() => runQueuedMutation(operation)),
      executeMutation: args.executeMutation,
      applyLifecycleIntents,
      applyReceiptSideEffects,
      recordUndoReceipt: (receipt) =>
        args.undoStore.getState().pushUndo(args.workspaceId, receipt, {
          replayFingerprint: fingerprintFileSystemSnapshot(args.cacheAdapter),
        }),
      onSuccess,
      reportError: args.effects.reportError,
      showProgress: args.effects.showProgress,
      dismissProgress: args.effects.dismissProgress,
      showReceiptToast: args.effects.showReceiptToast,
    })
    if (result.status === 'needsDecision') {
      updateSnapshot({
        pendingConflict: {
          command,
          createParentPlan,
          conflicts: result.conflicts,
          replayFingerprint: fingerprintFileSystemSnapshot(args.cacheAdapter),
          onSuccess,
        },
      })
    }
    return result
  }

  const discardCreatedItem = async (transactionId: FileSystemTransactionId) => {
    await withPendingOperation(() =>
      runQueuedMutation(() =>
        runFileSystemOptimisticMutation({
          cacheAdapter: args.cacheAdapter,
          apply: [],
          rollback: [],
          mutate: () => args.undoMutation(transactionId),
          onSuccess: async (receipt) => {
            args.undoStore.getState().removeUndoTransaction(args.workspaceId, transactionId)
            await applyReceiptSideEffects(receipt)
          },
          errorMessage: 'Failed to discard incomplete item',
          progressMessage: 'Discarding item...',
          reportError: args.effects.reportError,
          showProgress: args.effects.showProgress,
          dismissProgress: args.effects.dismissProgress,
        }),
      ),
    )
  }

  const runHistoryCommand = async (direction: 'undo' | 'redo') => {
    if (snapshot.pendingOperationCount > 0) {
      return {
        status: 'unavailable',
        reason: 'operation-pending',
      } satisfies ResourceCommandResult
    }
    const historyStore = args.undoStore.getState()
    const entry = direction === 'undo' ? historyStore.peekUndo() : historyStore.peekRedo()
    if (!entry) {
      return {
        status: 'unavailable',
        reason: `no-${direction}-entry`,
      } satisfies ResourceCommandResult
    }

    const currentResourceId = args.navigation.getCurrentResourceId()
    return await withPendingOperation(() =>
      executeFileSystemHistoryLifecycle({
        direction,
        entry,
        cacheAdapter: args.cacheAdapter,
        runMutation: (operation) => runQueuedMutation(operation),
        executeMutation: direction === 'undo' ? args.undoMutation : args.redoMutation,
        isEntryStale: (historyEntry) =>
          !args.undoStore.getState().isCurrentEntry(historyEntry) ||
          historyEntry.replayFingerprint !== fingerprintFileSystemSnapshot(args.cacheAdapter),
        recordHistorySuccess: (historyEntry) => {
          const store = args.undoStore.getState()
          const nextEntry = withFileSystemHistoryReplayFingerprint(
            historyEntry,
            fingerprintFileSystemSnapshot(args.cacheAdapter),
          )
          if (direction === 'undo') {
            store.removeUndo()
            store.pushRedoEntry(nextEntry)
          } else {
            store.removeRedo()
            store.pushUndoEntry(nextEntry, { preserveRedo: true })
          }
        },
        applyReceiptSideEffects: (receipt) => applyReceiptSideEffects(receipt, currentResourceId),
        reportError: args.effects.reportError,
        showProgress: args.effects.showProgress,
        dismissProgress: args.effects.dismissProgress,
        showReceiptToast: args.effects.showReceiptToast,
      }),
    )
  }

  const resolvePendingConflict = async (decisions: ResourceCommandDecisionRecord) => {
    const pendingConflict = snapshot.pendingConflict
    if (!pendingConflict) {
      return {
        status: 'unavailable',
        reason: 'no-pending-conflict',
      } satisfies ResourceCommandResult<ItemOperationConflict>
    }
    const command = pendingConflict.command
    const onSuccess = pendingConflict.onSuccess
    updateSnapshot({ pendingConflict: null })
    if (pendingConflict.replayFingerprint !== fingerprintFileSystemSnapshot(args.cacheAdapter)) {
      return {
        status: 'rejected',
        reason: 'stale-conflict',
      } satisfies ResourceCommandResult<ItemOperationConflict>
    }
    return await executeCommand(command, {
      createParentPlan: pendingConflict.createParentPlan,
      decisions,
      onSuccess,
    })
  }

  return {
    getSnapshot,
    subscribe,
    updateArgs,
    clearPendingConflict: () => updateSnapshot({ pendingConflict: null }),
    resolvePendingConflict,
    executeCommand,
    discardCreatedItem,
    runHistoryCommand,
  }
}
