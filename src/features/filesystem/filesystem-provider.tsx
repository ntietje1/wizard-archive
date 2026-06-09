import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from 'shared/campaigns/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { deduplicateName, findUniqueDefaultName } from 'shared/sidebar-items/default-name'
import type { FileSystemCommand } from 'shared/sidebar-items/filesystem/commands'
import type { FileSystemTransactionReceipt } from 'shared/sidebar-items/filesystem/receipts'
import type {
  ConflictDecision,
  ItemOperationConflict,
} from 'shared/sidebar-items/filesystem/conflicts'
import { assertSidebarItemName } from 'shared/sidebar-items/name'
import { normalizeSelectedRoots } from 'shared/sidebar-items/filesystem/selection'
import { FileSystemEmptyTrashDialog, FileSystemPermanentDeleteDialog } from './filesystem-dialogs'
import { ItemOperationConflictDialog } from './item-operation-conflict-dialog'
import { useFileSystemUndoStore } from './filesystem-undo-store'
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
import {
  SidebarWorkspaceSourceProvider,
  useSidebarWorkspaceSource,
} from '~/features/sidebar/workspace/sidebar-workspace-source'
import type {
  SidebarWorkspaceCreateItem,
  SidebarWorkspaceSource,
} from '~/features/sidebar/workspace/sidebar-workspace-source'
import { handleError, logger } from '~/shared/utils/logger'
import { createFileSystemCacheAdapter } from './filesystem-cache-adapter'
import { executeFileSystemCommandLifecycle } from './filesystem-command-lifecycle'
import { executeFileSystemHistoryLifecycle } from './filesystem-history-lifecycle'
import { runFileSystemOptimisticMutation } from './filesystem-optimistic-mutation-lifecycle'
import { applyFileSystemReceiptEffects } from './filesystem-receipt-effects'
import {
  getCreatedItemResult,
  getReceiptRenamedSlug,
  getReceiptToastMessage,
} from './filesystem-receipt-selectors'
import { toast } from 'sonner'
import {
  fileSystemDropCommandFailureMessage,
  resolveGlobalFileSystemDropCommand,
} from './filesystem-drop-planner'
import { applyFileSystemLifecycleIntents } from './filesystem-lifecycle-intents'
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

type FileSystemProviderState = {
  value: FileSystemValue
  dialog: ReactNode
  sidebarWorkspaceSource: SidebarWorkspaceSource
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
  const sidebarWorkspaceSource = useSidebarWorkspaceSource()
  const {
    selection: { activeItemSurface },
    selectionCommands: {
      clearItemSelection,
      getSelectionSnapshot,
      setSelected,
      setSelectedItemIds,
    },
    uiCommands,
  } = sidebarWorkspaceSource
  const clipboard = useFileSystemClipboard()
  const undoStack = useFileSystemUndoStore((s) => s.undoStack)
  const redoStack = useFileSystemUndoStore((s) => s.redoStack)
  const [pendingConflict, setPendingConflict] = useState<PendingConflict | null>(null)
  const [pendingDeleteForeverItems, setPendingDeleteForeverItems] =
    useState<Array<AnySidebarItem> | null>(null)
  const [pendingEmptyTrash, setPendingEmptyTrash] = useState(false)
  const [pendingTrashFolder, setPendingTrashFolder] = useState<AnySidebarItem | null>(null)
  const [pendingOperationCount, setPendingOperationCount] = useState(0)
  const pendingOperationCountRef = useRef(0)
  const mutationQueueRef = useRef<Promise<void> | null>(null)
  if (mutationQueueRef.current === null) {
    mutationQueueRef.current = Promise.resolve()
  }

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
      getSelectedItemIds: () => getSelectionSnapshot().selectedItemIds,
      setSelectedItemIds,
      clearEditorContent,
      navigateToItem,
    })
  }

  const applyLifecycleIntents = (
    intents: Parameters<typeof applyFileSystemLifecycleIntents>[0]['intents'],
    previousSlug: Parameters<typeof applyFileSystemLifecycleIntents>[0]['previousSlug'],
  ) =>
    applyFileSystemLifecycleIntents({
      intents,
      previousSlug,
      adapters: {
        setFolderState: (_campaignId, folderId, isOpen) =>
          uiCommands.setFolderState(folderId, isOpen),
        setSelectedItemIds,
        getSelectionState: () => ({
          ...getSelectionSnapshot(),
          clearItemSelection,
          setSelected,
        }),
        navigateToItem,
        clearEditorContent,
      },
    })

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
    const mutationQueue = mutationQueueRef.current
    if (!mutationQueue) throw new Error('Filesystem mutation queue was not initialized')
    const result = mutationQueue.then(operation, operation)
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
      onSuccess,
    }: {
      decisions?: Partial<Record<Id<'sidebarItems'>, ConflictDecision>>
      onSuccess?: () => void
    } = {},
  ): Promise<FileSystemTransactionReceipt | null> => {
    if (!campaignId) return null
    const result = await executeFileSystemCommandLifecycle({
      command,
      decisions,
      campaignId,
      currentUserId: campaign.data?.myMembership?.userId ?? null,
      activeItemSurface,
      cacheAdapter,
      createClientOperationId,
      getCurrentSlug: getSelectedSlug,
      runMutation: (operation) => withPendingOperation(() => runQueuedMutation(operation)),
      executeMutation: async (args) =>
        (await executeMutation.mutateAsync(args)) as FileSystemTransactionReceipt,
      applyLifecycleIntents,
      applyReceiptSideEffects,
      recordUndoReceipt: (receipt) => useFileSystemUndoStore.getState().pushUndo(receipt),
      onSuccess,
      reportError: reportFileSystemError,
      showProgress: toast.loading,
      dismissProgress: toast.dismiss,
      showReceiptToast: toastReceipt,
    })
    if (result.status === 'needsDecision') {
      setPendingConflict({ command, conflicts: result.conflicts, onSuccess })
      return null
    }
    return result.status === 'completed' ? result.receipt : null
  }

  const discardCreatedItem = async (transactionId: Id<'filesystemTransactions'>) => {
    await withPendingOperation(() =>
      runFileSystemOptimisticMutation({
        cacheAdapter,
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
        reportError: reportFileSystemError,
        showProgress: toast.loading,
        dismissProgress: toast.dismiss,
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

  const createSidebarItem: SidebarWorkspaceCreateItem = async (input) => {
    if (!campaignId) return null
    const currentReadModel = cacheAdapter.getReadModel()
    const siblings = currentReadModel.getActiveChildren(input.parentId)
    const fallbackName = findUniqueDefaultName(input.type, siblings)
    const requestedName = input.name?.trim() || fallbackName
    const name = assertSidebarItemName(
      deduplicateName(
        requestedName,
        siblings.map((item) => item.name),
      ),
    )

    try {
      const result = await createItem({
        itemType: input.type,
        parentTarget: { kind: 'direct', parentId: input.parentId },
        name,
      })
      if (result) {
        sidebarWorkspaceSource.commands.openParentFolders(result.id)
      }
      return result
    } catch (error) {
      handleError(error, 'Failed to create item')
      return null
    }
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

    await withPendingOperation(() =>
      executeFileSystemHistoryLifecycle({
        direction,
        entry,
        cacheAdapter,
        runMutation: (operation) => runQueuedMutation(operation),
        executeMutation: async (transactionId) =>
          direction === 'undo'
            ? ((await undoMutation.mutateAsync({ transactionId })) as FileSystemTransactionReceipt)
            : ((await redoMutation.mutateAsync({ transactionId })) as FileSystemTransactionReceipt),
        recordHistorySuccess: (historyEntry) => {
          const store = useFileSystemUndoStore.getState()
          if (direction === 'undo') {
            store.removeUndo()
            store.pushRedoEntry(historyEntry)
          } else {
            store.removeRedo()
            store.pushUndoEntry(historyEntry, { preserveRedo: true })
          }
        },
        applyReceiptSideEffects,
        reportError: reportFileSystemError,
        showProgress: toast.loading,
        dismissProgress: toast.dismiss,
        showReceiptToast: toastReceipt,
      }),
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
    const dropTargetParentId =
      command.command.type === 'trash' ? null : command.command.targetParentId
    const openDropTargetOnSuccess =
      dropTargetParentId && campaignId
        ? () => uiCommands.setFolderState(dropTargetParentId, true)
        : undefined
    try {
      switch (command.action) {
        case 'move':
        case 'copy':
        case 'restore':
        case 'trash':
          await executeCommand(command.command, { onSuccess: openDropTargetOnSuccess })
          break
        default:
          assertNever(command.action)
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
    sidebarWorkspaceSource: {
      ...sidebarWorkspaceSource,
      commands: {
        ...sidebarWorkspaceSource.commands,
        createSidebarItem,
      },
    },
    dialog: (
      <>
        <output
          aria-live="polite"
          aria-atomic="true"
          data-testid="filesystem-operation-status"
          data-state={pendingOperationCount > 0 ? 'pending' : 'idle'}
          className="sr-only"
        >
          {pendingOperationCount > 0 ? 'Filesystem operation in progress' : null}
        </output>
        {conflictDialog}
        {deleteForeverDialog}
        {emptyTrashDialog}
        {trashFolderDialog}
      </>
    ),
  }
}

export function FileSystemProvider({ children }: { children: ReactNode }) {
  const { value, dialog, sidebarWorkspaceSource } = useFileSystemValue()
  useFileSystemUndoHotkeys(value)

  useItemSurfaceHotkeys(value)

  return (
    <FileSystemContext.Provider value={value}>
      <SidebarWorkspaceSourceProvider value={sidebarWorkspaceSource}>
        {children}
      </SidebarWorkspaceSourceProvider>
      {dialog}
    </FileSystemContext.Provider>
  )
}
