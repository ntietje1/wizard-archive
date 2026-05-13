import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from 'convex/campaigns/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type {
  FileSystemCommand,
  FileSystemOperationDecision,
} from 'convex/sidebarItems/filesystem/commands'
import type { FileSystemTransactionReceipt } from 'convex/sidebarItems/filesystem/receipts'
import type {
  ConflictDecision,
  ItemOperationConflict,
} from 'convex/sidebarItems/filesystem/operationTypes'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'
import { FileSystemPermanentDeleteDialog } from './filesystem-dialogs'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { shouldRecordFileSystemUndo, useFileSystemUndoStore } from './filesystem-undo-store'
import { runFileSystemMutation } from './filesystem-command-runner'
import { FileSystemContext } from './useFileSystem'
import type { FileSystemValue } from './useFileSystem'
import { setFileSystemClipboard, useFileSystemClipboard } from './filesystem-clipboard-store'
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
import { toast } from 'sonner'
import { getPasteTargetParentId } from './filesystem-targets'
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

  const executeCommand = async (
    command: FileSystemCommand,
    {
      decisions,
    }: {
      decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
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
      setPendingConflict({ command, conflicts: plan.conflicts })
      return null
    }
    const clientOperationId = createClientOperationId()

    return await withPendingOperation(() =>
      runQueuedMutation(() =>
        runFileSystemMutation({
          patches: {
            apply: plan.preview.receiptPatches,
            rollback: plan.preview.inversePatches,
          },
          applyPatches: cacheAdapter.applyPatches,
          mutate: async () =>
            (await executeMutation.mutateAsync({
              command,
              decisions: toDecisionArray(decisions),
              clientOperationId,
            })) as FileSystemTransactionReceipt,
          onSuccess: async (receipt) => {
            if (shouldRecordFileSystemUndo(receipt)) {
              useFileSystemUndoStore.getState().pushUndo(receipt)
            }
            await applyReceiptSideEffects(receipt)
            toastReceipt(receipt)
          },
          onError: (error) => handleError(error, 'Filesystem operation failed'),
        }),
      ),
    )
  }

  const createItem: FileSystemValue['createItem'] = async (input) => {
    const receipt = await executeCommand({
      type: 'create',
      itemType: input.itemType,
      name: input.name,
      parentTarget: input.parentTarget,
      iconName: input.iconName,
      color: input.color,
    })
    return getCreatedItemResult(receipt)
  }

  const renameItem: FileSystemValue['renameItem'] = async (input) => {
    const receipt = await executeCommand({
      type: 'rename',
      itemId: input.itemId,
      name: input.name,
      iconName: input.iconName,
      color: input.color,
    })
    if (!receipt) return null
    return { slug: getReceiptRenamedSlug(receipt) }
  }

  const duplicateItems: FileSystemValue['duplicateItems'] = async (itemIds, targetParentId) => {
    await executeCommand({ type: 'copy', itemIds, targetParentId })
  }

  const trashItems = async (itemIds: Array<Id<'sidebarItems'>>) => {
    await executeCommand({ type: 'trash', itemIds })
  }

  const requestTrashItems: FileSystemValue['requestTrashItems'] = async (itemIds) => {
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return false
    if (items.length === 1) {
      const item = items[0]
      if (isFolder(item) && currentReadModel.getActiveChildren(item._id).length > 0) {
        setPendingTrashFolder(item)
        return true
      }
    }
    await trashItems(items.map((item) => item._id))
    return false
  }

  const restoreItems: FileSystemValue['restoreItems'] = async (itemIds, targetParentId = null) => {
    await executeCommand({ type: 'restore', itemIds, targetParentId })
  }

  const deleteForever = async (itemIds: Array<Id<'sidebarItems'>>) => {
    await executeCommand({ type: 'deleteForever', itemIds })
  }

  const emptyTrash: FileSystemValue['emptyTrash'] = async () => {
    await executeCommand({ type: 'emptyTrash' })
  }

  const copy = (itemIds: Array<Id<'sidebarItems'>>) => {
    if (!campaignId || itemIds.length === 0) return
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return
    setFileSystemClipboard({ mode: 'copy', campaignId, itemIds: items.map((item) => item._id) })
  }

  const cut = (itemIds: Array<Id<'sidebarItems'>>) => {
    if (!campaignId || itemIds.length === 0) return
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
    if (items.length === 0) return
    setFileSystemClipboard({ mode: 'cut', campaignId, itemIds: items.map((item) => item._id) })
  }

  const cancelClipboard = () => {
    if (!clipboard) return false
    setFileSystemClipboard(null)
    return true
  }

  const paste: FileSystemValue['paste'] = async (targetParentId) => {
    if (!campaignId || !clipboard || clipboard.campaignId !== campaignId) return
    const resolvedTargetParentId = getPasteTargetParentId(activeItemSurface, targetParentId)
    const currentReadModel = cacheAdapter.getReadModel()
    const items = normalizeOperationItems(
      currentReadModel.getItems(Array.from(clipboard.itemIds)),
      currentReadModel,
    )
    if (items.length === 0) return

    if (clipboard.mode === 'copy') {
      await duplicateItems(
        items.map((item) => item._id),
        resolvedTargetParentId,
      )
      return
    }

    if (items.every((item) => item.parentId === resolvedTargetParentId)) {
      setFileSystemClipboard(null)
      return
    }

    await executeCommand({
      type: 'move',
      itemIds: items.map((item) => item._id),
      targetParentId: resolvedTargetParentId,
    })
    setFileSystemClipboard(null)
  }

  const undo: FileSystemValue['undo'] = async () => {
    if (pendingOperationCountRef.current > 0) return
    const entry = useFileSystemUndoStore.getState().peekUndo()
    if (!entry) return
    if (!entry.transactionId) {
      logger.error('Filesystem undo entry is missing a transaction id', entry)
      return
    }
    await withPendingOperation(() =>
      runQueuedMutation(() =>
        runFileSystemMutation({
          patches: { apply: [], rollback: [] },
          applyPatches: cacheAdapter.applyPatches,
          mutate: async () =>
            (await undoMutation.mutateAsync({
              transactionId: entry.transactionId,
            })) as FileSystemTransactionReceipt,
          onSuccess: async (receipt) => {
            useFileSystemUndoStore.getState().removeUndo()
            useFileSystemUndoStore.getState().pushRedoEntry(entry)
            await applyReceiptSideEffects(receipt)
            toastReceipt(receipt)
          },
          onError: (error) => handleError(error, 'Filesystem undo failed'),
        }),
      ),
    )
  }

  const redo: FileSystemValue['redo'] = async () => {
    if (pendingOperationCountRef.current > 0) return
    const entry = useFileSystemUndoStore.getState().peekRedo()
    if (!entry) return
    if (!entry.transactionId) {
      logger.error('Filesystem redo entry is missing a transaction id', entry)
      return
    }
    await withPendingOperation(() =>
      runQueuedMutation(() =>
        runFileSystemMutation({
          patches: { apply: [], rollback: [] },
          applyPatches: cacheAdapter.applyPatches,
          mutate: async () =>
            (await redoMutation.mutateAsync({
              transactionId: entry.transactionId,
            })) as FileSystemTransactionReceipt,
          onSuccess: async (receipt) => {
            useFileSystemUndoStore.getState().removeRedo()
            useFileSystemUndoStore.getState().pushUndoEntry(entry, { preserveRedo: true })
            await applyReceiptSideEffects(receipt)
            toastReceipt(receipt)
          },
          onError: (error) => handleError(error, 'Filesystem redo failed'),
        }),
      ),
    )
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
    if (items.length === 0) return false
    setPendingDeleteForeverItems(items)
    return true
  }

  const resolveConflicts = async (
    decisions: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>,
  ) => {
    if (!pendingConflict) return
    const command = pendingConflict.command
    setPendingConflict(null)
    await executeCommand(command, { decisions })
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
      emptyTrash,
      confirmDeleteForever,
      copy,
      cut,
      cancelClipboard,
      canPaste: Boolean(campaignId && clipboard?.campaignId === campaignId),
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
