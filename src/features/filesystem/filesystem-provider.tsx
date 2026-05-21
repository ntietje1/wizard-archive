import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '~/features/campaigns/campaign-types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  FileSystemCommand,
  FileSystemOperationDecision,
} from 'convex/sidebarItems/filesystem/commands'
import type {
  FileSystemPatch,
  FileSystemTransactionReceipt,
} from 'convex/sidebarItems/filesystem/receipts'
import type {
  ConflictDecision,
  ItemOperationConflict,
} from 'convex/sidebarItems/filesystem/conflicts'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'
import { FileSystemEmptyTrashDialog, FileSystemPermanentDeleteDialog } from './filesystem-dialogs'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { shouldRecordFileSystemUndo, useFileSystemUndoStore } from './filesystem-undo-store'
import { FileSystemContext } from './useFileSystem'
import type { FileSystemValue } from './useFileSystem'
import { setFileSystemClipboard, useFileSystemClipboard } from './filesystem-clipboard-store'
import {
  createFileSystemClipboard,
  createFileSystemDuplicateCommand,
  resolveFileSystemClipboardCommand,
} from './filesystem-command-intents'
import { getContextMenuPasteParentId } from './filesystem-targets'
import { useFileSystemUndoHotkeys } from './filesystem-hotkeys'
import { planFileSystemOptimisticCommand } from './filesystem-optimistic-planner'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSidebarItemsCache } from '~/features/sidebar/hooks/useSidebarItemsCache'
import { useEditorNavigation } from '~/features/sidebar/hooks/useEditorNavigation'
import { useItemSurfaceHotkeys } from '~/features/sidebar/hooks/useItemSurfaceHotkeys'
import { getSelectedSlug } from '~/features/sidebar/hooks/useSelectedItem'
import { useCampaignMutation } from '~/shared/hooks/useCampaignMutation'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { handleError, logger } from '~/shared/utils/logger'
import { createFileSystemCacheAdapter } from './filesystem-cache-adapter'
import { applyFileSystemReceiptEffects } from './filesystem-receipt-effects'
import {
  getCreatedItemResult,
  getReceiptRenamedSlug,
  getReceiptToastMessage,
} from './filesystem-receipt-selectors'
import {
  getCommandProgressToastText,
  getHistoryProgressToastText,
} from './filesystem-progress-messages'
import { toast } from 'sonner'
import {
  fileSystemDropCommandFailureMessage,
  resolveGlobalFileSystemDropCommand,
} from './filesystem-drop-planner'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { FolderDeleteConfirmDialog } from '~/features/sidebar/components/folder-delete-confirm-dialog'
import { assertNever } from '~/shared/utils/utils'

type PendingConflict = {
  command: FileSystemCommand
  conflicts: Array<ItemOperationConflict>
  onSuccess?: () => void
}

function createClientOperationId() {
  return globalThis.crypto?.randomUUID?.() ?? `filesystem-${Date.now()}-${Math.random()}`
}

function toDecisionArray(
  decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
): Array<FileSystemOperationDecision> | undefined {
  if (!decisions) return undefined
  const result: Array<FileSystemOperationDecision> = []
  for (const [sourceItemId, decision] of Object.entries(decisions)) {
    if (decision) {
      result.push({ sourceItemId: sourceItemId as Id<'sidebarItems'>, action: decision.action })
    }
  }
  return result
}

function toastReceipt(receipt: FileSystemTransactionReceipt) {
  const message = getReceiptToastMessage(receipt)
  if (!message) return
  switch (message.type) {
    case 'success':
      toast.success(message.text)
      return
    case 'info':
      toast.info(message.text)
      return
    default:
      return assertNever(message)
  }
}

function reportFileSystemError(error: unknown, message: string) {
  try {
    handleError(error, message)
  } catch (reportError) {
    logger.error('Failed to report filesystem error', { message, error, reportError })
  }
}

function applyPatchArray(
  applyPatches: (patches: Array<FileSystemPatch>) => void,
  patches: Array<FileSystemPatch>,
) {
  if (patches.length === 0) return
  applyPatches(patches)
}

type FileSystemProviderState = {
  value: FileSystemValue
  dialog: ReactNode
}

function useFileSystemValue(): FileSystemProviderState {
  const { campaignId, campaign } = useCampaign()
  useActiveSidebarItems()
  useTrashSidebarItems()
  const cache = useSidebarItemsCache()
  const { clearEditorContent, navigateToItem } = useEditorNavigation()
  const executeMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
  )
  const undoMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
  )
  const redoMutation = useCampaignMutation(
    api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
  )
  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
  const setFolderState = useSidebarUIStore((s) => s.setFolderState)
  const clipboard = useFileSystemClipboard()
  const setSelectedItemIds = useSidebarUIStore((s) => s.setSelectedItemIds)
  const undoStack = useFileSystemUndoStore((s) => s.undoStack)
  const redoStack = useFileSystemUndoStore((s) => s.redoStack)
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null)
  const [pendingDeleteForeverItems, setPendingDeleteForeverItems] =
    useState<Array<AnySidebarItem> | null>(null)
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false)
  const [pendingTrashFolder, setPendingTrashFolder] = useState<AnySidebarItem | null>(null)
  const [pendingOperationCount, setPendingOperationCount] = useState(0)
  const pendingOperationCountRef = useRef(0)
  const mutationQueueRef = useRef(Promise.resolve())

  useEffect(() => {
    if (!campaignId) return
    useFileSystemUndoStore.getState().setCampaign(campaignId)
    setFileSystemClipboard(null)
  }, [campaignId])

  const cacheAdapter = createFileSystemCacheAdapter(cache)

  const normalizeOperationItems = (
    items: Array<AnySidebarItem>,
    model = cacheAdapter.getReadModel(),
  ) => normalizeSelectedRoots(items, model.itemsById)

  const applyReceiptSideEffects = async (receipt: FileSystemTransactionReceipt) => {
    await applyFileSystemReceiptEffects({
      receipt,
      readModel: cacheAdapter.getReadModel(),
      currentSlug: getSelectedSlug(),
      getSelectedItemIds: () => useSidebarUIStore.getState().selectedItemIds,
      setSelectedItemIds,
      clearEditorContent,
      navigateToItem,
    })
  }

  const withPendingOperation = async <T,>(operation: () => Promise<T>): Promise<T> => {
    pendingOperationCountRef.current += 1
    setPendingOperationCount((count) => count + 1)
    try {
      return await operation()
    } finally {
      pendingOperationCountRef.current = Math.max(0, pendingOperationCountRef.current - 1)
      setPendingOperationCount((count) => Math.max(0, count - 1))
    }
  }

  const runQueuedMutation = (operation: () => Promise<FileSystemTransactionReceipt | null>) => {
    // mutationQueueRef is a Promise chain; using operation for both outcomes keeps later mutations serialized after failures.
    const result = mutationQueueRef.current.then(operation, operation)
    mutationQueueRef.current = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const runOptimisticMutation = async ({
    apply,
    rollback,
    mutate,
    onOptimisticApplied,
    onMutationFailure,
    onSuccess,
    errorMessage,
    progressMessage,
  }: {
    apply: Array<FileSystemPatch>
    rollback: Array<FileSystemPatch>
    mutate: () => Promise<FileSystemTransactionReceipt>
    onOptimisticApplied?: () => Promise<void> | void
    onMutationFailure?: () => Promise<void> | void
    onSuccess: (receipt: FileSystemTransactionReceipt) => Promise<void> | void
    errorMessage: string
    progressMessage?: string
  }): Promise<FileSystemTransactionReceipt | null> => {
    try {
      applyPatchArray(cacheAdapter.applyPatches, apply)
    } catch (error) {
      reportFileSystemError(error, errorMessage)
      return null
    }

    try {
      await onOptimisticApplied?.()
    } catch (error) {
      try {
        applyPatchArray(cacheAdapter.applyPatches, rollback)
        await onMutationFailure?.()
      } catch (rollbackError) {
        reportFileSystemError(rollbackError, errorMessage)
      }
      reportFileSystemError(error, errorMessage)
      return null
    }

    let receipt: FileSystemTransactionReceipt | null = null
    let mutationError: unknown = null
    const progressToastId = progressMessage ? toast.loading(progressMessage) : null
    try {
      receipt = await mutate()
    } catch (error) {
      mutationError = error
    } finally {
      if (progressToastId) toast.dismiss(progressToastId)
    }

    if (mutationError) {
      try {
        applyPatchArray(cacheAdapter.applyPatches, rollback)
        await onMutationFailure?.()
      } catch (rollbackError) {
        reportFileSystemError(rollbackError, errorMessage)
      }
      reportFileSystemError(mutationError, errorMessage)
      return null
    }
    if (!receipt) return null

    try {
      applyPatchArray(cacheAdapter.applyPatches, [...rollback, ...receipt.patches])
      await onSuccess(receipt)
      return receipt
    } catch (error) {
      reportFileSystemError(error, errorMessage)
      return null
    }
  }

  const executeCommand = async (
    command: FileSystemCommand,
    {
      decisions,
      onSuccess,
    }: {
      decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
      onSuccess?: () => void
    } = {},
  ): Promise<FileSystemTransactionReceipt | null> => {
    if (!campaignId) return null
    const currentReadModel = cacheAdapter.getReadModel()
    const plan = planFileSystemOptimisticCommand({
      command,
      decisions,
      snapshot: cacheAdapter.getSnapshot(),
      readModel: currentReadModel,
      activeItemSurface,
      currentUserId: campaign.data?.myMembership?.userId ?? null,
      campaignId,
    })
    if (plan.status === 'needsDecision') {
      setPendingConflict({ command, conflicts: plan.conflicts, onSuccess })
      return null
    }
    const clientOperationId = createClientOperationId()
    const optimisticItem = plan.preview.optimisticItem
    const previousSlug = getSelectedSlug()

    return await withPendingOperation(() =>
      runQueuedMutation(() =>
        runOptimisticMutation({
          apply: plan.preview.receiptPatches,
          rollback: plan.preview.inversePatches,
          onOptimisticApplied: optimisticItem
            ? async () => {
                if (optimisticItem.parentId) {
                  setFolderState(campaignId, optimisticItem.parentId, true)
                }
                setSelectedItemIds([optimisticItem._id], optimisticItem._id)
                useSidebarUIStore.getState().setSelected(optimisticItem.slug)
                await navigateToItem(optimisticItem.slug)
              }
            : undefined,
          onMutationFailure: optimisticItem
            ? async () => {
                const state = useSidebarUIStore.getState()
                if (
                  state.selectedSlug !== optimisticItem.slug &&
                  !state.selectedItemIds.includes(optimisticItem._id)
                ) {
                  return
                }
                state.clearItemSelection()
                if (previousSlug) {
                  state.setSelected(previousSlug)
                  await navigateToItem(previousSlug, true)
                } else {
                  await clearEditorContent()
                }
              }
            : undefined,
          mutate: async () =>
            (await executeMutation.mutateAsync({
              command,
              decisions: toDecisionArray(decisions),
              clientOperationId,
            })) as FileSystemTransactionReceipt,
          progressMessage: getCommandProgressToastText(command),
          onSuccess: async (receipt) => {
            if (shouldRecordFileSystemUndo(receipt)) {
              useFileSystemUndoStore.getState().pushUndo(receipt)
            }
            await applyReceiptSideEffects(receipt)
            onSuccess?.()
            toastReceipt(receipt)
          },
          errorMessage: 'Filesystem operation failed',
        }),
      ),
    )
  }

  const discardCreatedItem = async (transactionId: Id<'filesystemTransactions'>) => {
    await withPendingOperation(() =>
      runOptimisticMutation({
        apply: [],
        rollback: [],
        mutate: async () =>
          (await undoMutation.mutateAsync({ transactionId })) as FileSystemTransactionReceipt,
        onSuccess: async (receipt) => {
          useFileSystemUndoStore.getState().removeUndoTransaction(transactionId)
          await applyReceiptSideEffects(receipt)
        },
        errorMessage: 'Failed to discard incomplete item',
        progressMessage: 'Discarding item...',
      }),
    )
  }

  const createItem: FileSystemValue['createItem'] = async (input, initialize) => {
    const receipt = await executeCommand({ type: 'create', ...input })
    const created = getCreatedItemResult(receipt)
    if (!created) return null
    try {
      await initialize?.({ id: created.id, slug: created.slug })
    } catch (error) {
      await discardCreatedItem(created.transactionId)
      throw error
    }
    return { id: created.id, slug: created.slug }
  }

  const renameItem: FileSystemValue['renameItem'] = async (input) => {
    const receipt = await executeCommand({ type: 'rename', ...input })
    if (!receipt) return null
    return { slug: getReceiptRenamedSlug(receipt) }
  }

  const duplicateItems: FileSystemValue['duplicateItems'] = async (itemIds) => {
    const command = createFileSystemDuplicateCommand(itemIds, cacheAdapter.getReadModel())
    if (command) await executeCommand(command)
  }

  const trashItems = async (itemIds: Array<Id<'sidebarItems'>>) => {
    await executeCommand({ type: 'trash', itemIds })
  }

  const requestTrashItems: FileSystemValue['requestTrashItems'] = async (itemIds) => {
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return
    if (items.length === 1) {
      const item = items[0]
      if (isFolder(item) && currentReadModel.getActiveChildren(item._id).length > 0) {
        setPendingTrashFolder(item)
        return
      }
    }
    await trashItems(items.map((item) => item._id))
  }

  const restoreItems: FileSystemValue['restoreItems'] = async (itemIds, targetParentId = null) => {
    await executeCommand({ type: 'restore', itemIds, targetParentId })
  }

  const deleteForever = async (itemIds: Array<Id<'sidebarItems'>>) => {
    await executeCommand({ type: 'deleteForever', itemIds })
  }

  const emptyTrash = async () => {
    await executeCommand({ type: 'emptyTrash' })
  }

  const copy = (itemIds: Array<Id<'sidebarItems'>>) => {
    setFileSystemClipboard(
      createFileSystemClipboard('copy', itemIds, campaignId, cacheAdapter.getReadModel()),
    )
  }

  const cut = (itemIds: Array<Id<'sidebarItems'>>) => {
    setFileSystemClipboard(
      createFileSystemClipboard('cut', itemIds, campaignId, cacheAdapter.getReadModel()),
    )
  }

  const cancelClipboard = () => {
    if (!clipboard) return false
    setFileSystemClipboard(null)
    return true
  }

  const paste: FileSystemValue['paste'] = async (targetParentId) => {
    const resolved = resolveFileSystemClipboardCommand({
      clipboard,
      campaignId,
      activeItemSurface,
      targetParentId,
      readModel: cacheAdapter.getReadModel(),
    })
    if (!resolved.command) {
      if (resolved.clearClipboard) setFileSystemClipboard(null)
      return
    }
    await executeCommand(resolved.command, {
      onSuccess: resolved.clearClipboard ? () => setFileSystemClipboard(null) : undefined,
    })
  }

  const canPasteIntoTarget: FileSystemValue['canPasteIntoTarget'] = ({
    clickedItem,
    operationItems,
  }) => {
    return Boolean(
      campaignId &&
      clipboard?.campaignId === campaignId &&
      getContextMenuPasteParentId({ clickedItem, operationItems }) !== undefined,
    )
  }

  const pasteIntoTarget: FileSystemValue['pasteIntoTarget'] = async ({
    clickedItem,
    operationItems,
  }) => {
    const parentId = getContextMenuPasteParentId({ clickedItem, operationItems })
    if (parentId === undefined) return
    await paste(parentId)
  }

  const undo: FileSystemValue['undo'] = async () => {
    await runHistoryCommand('undo')
  }

  const redo: FileSystemValue['redo'] = async () => {
    await runHistoryCommand('redo')
  }

  async function runHistoryCommand(direction: 'undo' | 'redo') {
    if (pendingOperationCountRef.current > 0) return
    const undoStore = useFileSystemUndoStore.getState()
    const entry = direction === 'undo' ? undoStore.peekUndo() : undoStore.peekRedo()
    if (!entry) return

    const receipt = await withPendingOperation(() =>
      runQueuedMutation(() =>
        runOptimisticMutation({
          apply: [],
          rollback: [],
          mutate: async () =>
            direction === 'undo'
              ? ((await undoMutation.mutateAsync({
                  transactionId: entry.transactionId,
                })) as FileSystemTransactionReceipt)
              : ((await redoMutation.mutateAsync({
                  transactionId: entry.transactionId,
                })) as FileSystemTransactionReceipt),
          onSuccess: async (historyReceipt) => {
            const store = useFileSystemUndoStore.getState()
            if (direction === 'undo') {
              store.removeUndo()
              store.pushRedoEntry(entry)
            } else {
              store.removeRedo()
              store.pushUndoEntry(entry, { preserveRedo: true })
            }
            await applyReceiptSideEffects(historyReceipt)
          },
          errorMessage: direction === 'undo' ? 'Filesystem undo failed' : 'Filesystem redo failed',
          progressMessage: getHistoryProgressToastText(direction),
        }),
      ),
    )
    if (receipt) toastReceipt(receipt)
  }

  const executeDrop: FileSystemValue['executeDrop'] = async ({ itemIds, target, options }) => {
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return

    const command = resolveGlobalFileSystemDropCommand(
      items,
      target,
      { isDm: campaign.data?.myMembership?.role === CAMPAIGN_MEMBER_ROLE.DM },
      options,
    )
    if (command.status === 'noop') return
    if (command.status === 'blocked') {
      handleError(new Error(command.reason), 'Cannot drop items here')
      return
    }
    if (command.status !== 'ready') return
    try {
      switch (command.action) {
        case 'move':
        case 'copy':
        case 'restore':
        case 'trash':
          await executeCommand(command.command)
          break
        default:
          assertNever(command.action)
      }
      if (command.command.type !== 'trash' && command.command.targetParentId && campaignId) {
        setFolderState(campaignId, command.command.targetParentId, true)
      }
    } catch (error) {
      handleError(error, fileSystemDropCommandFailureMessage(command))
    }
  }

  const confirmDeleteForever: FileSystemValue['confirmDeleteForever'] = (itemIds) => {
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return
    setPendingDeleteForeverItems(items)
  }

  const confirmEmptyTrash: FileSystemValue['confirmEmptyTrash'] = () => {
    setPendingEmptyTrash(true)
  }

  const resolveConflicts = async (
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!pendingConflict) return
    const command = pendingConflict.command
    const onSuccess = pendingConflict.onSuccess
    setPendingConflict(null)
    await executeCommand(command, { decisions, onSuccess })
  }

  const conflictDialog = pendingConflict ? (
    <ItemOperationConflictDialog
      key={pendingConflict.conflicts
        .map((conflict) => `${conflict.sourceItemId}:${conflict.destinationItemId}`)
        .join(':')}
      conflicts={pendingConflict.conflicts}
      onResolve={(decisions) => {
        void resolveConflicts(decisions)
      }}
      onCancel={() => setPendingConflict(null)}
    />
  ) : null

  const deleteForeverDialog = pendingDeleteForeverItems ? (
    <FileSystemPermanentDeleteDialog
      items={pendingDeleteForeverItems}
      onClose={() => setPendingDeleteForeverItems(null)}
      onConfirm={() => {
        const itemIds = pendingDeleteForeverItems.map((item) => item._id)
        setPendingDeleteForeverItems(null)
        void deleteForever(itemIds)
      }}
    />
  ) : null

  const emptyTrashDialog = pendingEmptyTrash ? (
    <FileSystemEmptyTrashDialog
      onClose={() => setPendingEmptyTrash(false)}
      onConfirm={() => {
        setPendingEmptyTrash(false)
        void emptyTrash()
      }}
    />
  ) : null

  const trashFolderDialog =
    pendingTrashFolder && isFolder(pendingTrashFolder) ? (
      <FolderDeleteConfirmDialog
        key={`trash-folder-${pendingTrashFolder._id}`}
        folder={pendingTrashFolder}
        isDeleting={true}
        onTrash={() => trashItems([pendingTrashFolder._id])}
        onClose={() => setPendingTrashFolder(null)}
      />
    ) : null

  return {
    value: {
      createItem,
      renameItem,
      duplicateItems,
      requestTrashItems,
      restoreItems,
      confirmEmptyTrash,
      confirmDeleteForever,
      copy,
      cut,
      cancelClipboard,
      canPaste: Boolean(campaignId && clipboard?.campaignId === campaignId),
      canPasteIntoTarget,
      pasteIntoTarget,
      paste,
      undo,
      redo,
      executeDrop,
      canUndo: pendingOperationCount === 0 && undoStack.length > 0,
      canRedo: pendingOperationCount === 0 && redoStack.length > 0,
    },
    dialog: (
      <>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="filesystem-operation-status"
          data-state={pendingOperationCount > 0 ? 'pending' : 'idle'}
          className="sr-only"
        >
          {pendingOperationCount > 0 ? 'Filesystem operation in progress' : null}
        </div>
        {conflictDialog}
        {deleteForeverDialog}
        {emptyTrashDialog}
        {trashFolderDialog}
      </>
    ),
  }
}

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const { value, dialog } = useFileSystemValue()
  useFileSystemUndoHotkeys(value)

  useItemSurfaceHotkeys(value)

  return (
    <FileSystemContext.Provider value={value}>
      {children}
      {dialog}
    </FileSystemContext.Provider>
  )
}
