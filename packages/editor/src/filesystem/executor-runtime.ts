import type { SidebarItemId, UserProfileId } from '../../../../shared/common/ids'
import type {
  ResourceCommand,
  ResourceCommandExecutionOptions,
  ResourceCommandMutationInput,
  ResourceCommandResult,
  ResourceTransactionReceipt,
} from './transaction-contract'
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
import { DOMAIN_ID_KIND, generateDomainId } from '../resources/domain-id'
import type { OperationId } from '../resources/domain-id'

type ExecuteFileSystemHistoryMutation = (
  transactionId: OperationId,
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

type FileSystemExecutorSnapshot = {
  pendingOperationCount: number
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

function createOperationId() {
  return generateDomainId(DOMAIN_ID_KIND.operation)
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
    operationArgs: FileSystemExecutorRuntimeArgs,
    receipt: ResourceTransactionReceipt,
    currentResourceId = operationArgs.navigation.getCurrentResourceId(),
  ) => {
    await applyFileSystemReceiptEffects({
      receipt,
      readModel: operationArgs.cacheAdapter.getReadModel(),
      currentResourceId,
      getSelectedItemIds: () =>
        operationArgs.selectionCommands.getSelectionSnapshot().selectedItemIds,
      setSelectedItemIds: operationArgs.selectionCommands.setSelectedItemIds,
      clearWorkspaceContent: operationArgs.navigation.clearWorkspaceContent,
      openResource: operationArgs.navigation.openResource,
      reportEffectError: operationArgs.effects.reportReceiptEffectError,
    })
  }

  const applyLifecycleIntents = (
    operationArgs: FileSystemExecutorRuntimeArgs,
    intents: Array<FileSystemLifecycleIntent>,
    previousResourceId: SidebarItemId | null,
  ) =>
    applyFileSystemLifecycleIntents({
      intents,
      previousResourceId,
      readModel: operationArgs.cacheAdapter.getReadModel(),
      adapters: {
        setFolderState: (_workspaceId, folderId, isOpen) =>
          operationArgs.uiCommands.setFolderState(folderId, isOpen),
        setSelectedItemIds: operationArgs.selectionCommands.setSelectedItemIds,
        getSelectionState: () => ({
          ...operationArgs.selectionCommands.getSelectionSnapshot(),
          clearItemSelection: operationArgs.selectionCommands.clearItemSelection,
        }),
        getCurrentResourceId: operationArgs.navigation.getCurrentResourceId,
        openResource: operationArgs.navigation.openResource,
        clearWorkspaceContent: operationArgs.navigation.clearWorkspaceContent,
      },
    })

  const executeCommand = async (
    command: ResourceCommand,
    { createParentPlan, onSuccess }: ResourceCommandExecutionOptions = {},
  ): Promise<ResourceCommandResult> => {
    const operationArgs = args
    return await executeFileSystemCommandLifecycle({
      command,
      createParentPlan,
      workspaceId: operationArgs.workspaceId,
      currentUserId: operationArgs.currentUserId,
      activeItemSurface: operationArgs.activeItemSurface,
      cacheAdapter: operationArgs.cacheAdapter,
      createOperationId,
      getCurrentResourceId: operationArgs.navigation.getCurrentResourceId,
      runMutation: (operation) => withPendingOperation(() => runQueuedMutation(operation)),
      executeMutation: operationArgs.executeMutation,
      applyLifecycleIntents: (intents, previousResourceId) =>
        applyLifecycleIntents(operationArgs, intents, previousResourceId),
      applyReceiptSideEffects: (receipt) => applyReceiptSideEffects(operationArgs, receipt),
      recordUndoReceipt: (receipt) =>
        operationArgs.undoStore.getState().pushUndo(operationArgs.workspaceId, receipt, {
          replayFingerprint: fingerprintFileSystemSnapshot(operationArgs.cacheAdapter),
        }),
      onSuccess,
      reportError: operationArgs.effects.reportError,
      showProgress: operationArgs.effects.showProgress,
      dismissProgress: operationArgs.effects.dismissProgress,
      showReceiptToast: operationArgs.effects.showReceiptToast,
    })
  }

  const discardCreatedItem = async (transactionId: OperationId) => {
    const operationArgs = args
    await withPendingOperation(() =>
      runQueuedMutation(() =>
        runFileSystemOptimisticMutation({
          cacheAdapter: operationArgs.cacheAdapter,
          apply: [],
          rollback: [],
          mutate: () => operationArgs.undoMutation(transactionId),
          onSuccess: async (receipt) => {
            operationArgs.undoStore
              .getState()
              .removeUndoTransaction(operationArgs.workspaceId, transactionId)
            await applyReceiptSideEffects(operationArgs, receipt)
          },
          errorMessage: 'Failed to discard incomplete item',
          progressMessage: 'Discarding item...',
          reportError: operationArgs.effects.reportError,
          showProgress: operationArgs.effects.showProgress,
          dismissProgress: operationArgs.effects.dismissProgress,
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
    const operationArgs = args
    const historyStore = operationArgs.undoStore.getState()
    const entry = direction === 'undo' ? historyStore.peekUndo() : historyStore.peekRedo()
    if (!entry) {
      return {
        status: 'unavailable',
        reason: `no-${direction}-entry`,
      } satisfies ResourceCommandResult
    }

    const currentResourceId = operationArgs.navigation.getCurrentResourceId()
    return await withPendingOperation(() =>
      executeFileSystemHistoryLifecycle({
        direction,
        entry,
        cacheAdapter: operationArgs.cacheAdapter,
        runMutation: (operation) => runQueuedMutation(operation),
        executeMutation:
          direction === 'undo' ? operationArgs.undoMutation : operationArgs.redoMutation,
        isEntryStale: (historyEntry) =>
          !operationArgs.undoStore.getState().isCurrentEntry(historyEntry) ||
          historyEntry.replayFingerprint !==
            fingerprintFileSystemSnapshot(operationArgs.cacheAdapter),
        recordHistorySuccess: (historyEntry) => {
          const store = operationArgs.undoStore.getState()
          const nextEntry = withFileSystemHistoryReplayFingerprint(
            historyEntry,
            fingerprintFileSystemSnapshot(operationArgs.cacheAdapter),
          )
          if (direction === 'undo') {
            store.removeUndo()
            store.pushRedoEntry(nextEntry)
          } else {
            store.removeRedo()
            store.pushUndoEntry(nextEntry, { preserveRedo: true })
          }
        },
        applyReceiptSideEffects: (receipt) =>
          applyReceiptSideEffects(operationArgs, receipt, currentResourceId),
        reportError: operationArgs.effects.reportError,
        showProgress: operationArgs.effects.showProgress,
        dismissProgress: operationArgs.effects.dismissProgress,
        showReceiptToast: operationArgs.effects.showReceiptToast,
      }),
    )
  }

  return {
    getSnapshot,
    subscribe,
    updateArgs,
    executeCommand,
    discardCreatedItem,
    runHistoryCommand,
  }
}
