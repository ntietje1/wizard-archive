import { Fragment, createElement, useEffect, useMemo, useRef } from 'react'

import type {
  ResourceClipboardDriver,
  ResourceHistoryOperationDriver,
  ResourceOperationDriver,
  ResourceCommandRuntime,
  ResourceCommandRuntimeArgs,
  ResourceCommandDriver,
  ResourceDropDriver,
  ResourceTrashDriver,
} from './operation-runtime-contract'
import { handleError } from '../errors/handle-error'
import { setFileSystemClipboard } from './clipboard'
import { useFileSystemClipboardOperations } from './clipboard-operations'
import { createFileSystemCacheAdapter } from './cache'
import { useFileSystemDialogs } from './dialogs'
import { createFileSystemExecutorEffects } from './executor-effects'
import { useFileSystemExecutor } from './executor'
import { fileSystemDropCommandFailureMessage } from './drop-planner'
import {
  createFileSystemItemCommandOperations,
  createFileSystemTrashDialogOperations,
} from './item-command-operations'
import { createSidebarItemsShareCommandOperations } from '../sharing/sidebar-items/command-operations'
import { createFileSystemUndoStore } from './undo-store'
import type { FileSystemUndoStore } from './undo-store'
import { useWorkspaceFileSystemOperationState } from '../workspace/sidebar/ui-store'

export function useWorkspaceResourceCommandRuntime({
  workspaceId,
  currentActorId,
  cache,
  navigation,
  trashState,
  executeMutation,
  undoMutation,
  redoMutation,
}: ResourceCommandRuntimeArgs): ResourceCommandRuntime {
  const undoStoreRef = useRef<FileSystemUndoStore | null>(null)
  if (!undoStoreRef.current) {
    undoStoreRef.current = createFileSystemUndoStore()
  }
  const undoStore = undoStoreRef.current
  const undoStack = undoStore((s) => s.undoStack)
  const redoStack = undoStore((s) => s.redoStack)
  const { activeItemSurface, selectionCommands, uiCommands } =
    useWorkspaceFileSystemOperationState(workspaceId)

  useEffect(() => {
    undoStore.getState().setWorkspace(workspaceId)
    setFileSystemClipboard(null)
  }, [undoStore, workspaceId])

  const cacheAdapter = useMemo(() => createFileSystemCacheAdapter(cache), [cache])
  const executorEffects = useMemo(() => createFileSystemExecutorEffects(), [])
  const { pendingOperationCount, executeCommand, discardCreatedItem, runHistoryCommand } =
    useFileSystemExecutor({
      workspaceId,
      currentActorId,
      activeItemSurface,
      cacheAdapter,
      navigation,
      selectionCommands,
      uiCommands,
      executeMutation,
      undoMutation,
      redoMutation,
      undoStore,
      effects: executorEffects,
    })

  const itemCommandOperations = createFileSystemItemCommandOperations({
    discardCreatedItem,
    executeCommand,
  })
  const sharingOperations = createSidebarItemsShareCommandOperations({ executeCommand })
  const { deleteForever, emptyTrash, restoreItems, trashItems, ...itemOperations } =
    itemCommandOperations

  const dialogs = useFileSystemDialogs({
    cacheAdapter,
    trashState,
    trashItems: async (itemIds) => await trashItems(itemIds),
    deleteForever: async (itemIds) => await deleteForever(itemIds),
    emptyTrash: async () => await emptyTrash(),
  })
  const trashDialogOperations = createFileSystemTrashDialogOperations({
    cacheAdapter,
    dialogs,
    trashItems,
  })

  const clipboardOperations = useFileSystemClipboardOperations({
    workspaceId,
    activeItemSurface,
    cacheAdapter,
    executeCommand,
  })
  const executeDropCommand: ResourceDropDriver['executeDropCommand'] = async (command) => {
    const dropTargetParentId = command.type === 'trash' ? null : command.targetParentId
    const openDropTargetOnSuccess = dropTargetParentId
      ? () => uiCommands.setFolderState(dropTargetParentId, true)
      : undefined
    try {
      return await executeCommand(command, { onSuccess: openDropTargetOnSuccess })
    } catch (error) {
      handleError(error, fileSystemDropCommandFailureMessage(command))
      return { status: 'error', error }
    }
  }
  const dropOperations: ResourceDropDriver = {
    executeDropCommand,
  }

  const undo: ResourceHistoryOperationDriver['undo'] = async () => {
    return runHistoryCommand('undo')
  }

  const redo: ResourceHistoryOperationDriver['redo'] = async () => {
    return runHistoryCommand('redo')
  }

  const operations: ResourceOperationDriver = {
    ...itemOperations,
  }
  const trashOperations: ResourceTrashDriver = {
    ...trashDialogOperations,
    restoreItems,
  }
  const clipboardDriver: ResourceClipboardDriver = {
    copy: clipboardOperations.copy,
    cut: clipboardOperations.cut,
    canUseClipboardOperations: clipboardOperations.canUseClipboardOperations,
    cancelClipboard: clipboardOperations.cancelClipboard,
    canPaste: clipboardOperations.canPaste,
    paste: clipboardOperations.paste,
  }
  const historyOperations: ResourceHistoryOperationDriver = {
    undo,
    redo,
    canUndo: pendingOperationCount === 0 && undoStack.length > 0,
    canRedo: pendingOperationCount === 0 && redoStack.length > 0,
  }
  const resourceCommands: ResourceCommandDriver = {
    executeCommand,
    discardCreatedItem,
    undo,
    redo,
    canUndo: historyOperations.canUndo,
    canRedo: historyOperations.canRedo,
  }

  return {
    filesystem: {
      resourceCommands,
      operations,
      clipboardOperations: clipboardDriver,
      dropOperations,
      trashOperations,
      historyOperations,
      dialog: createElement(
        Fragment,
        null,
        createElement(
          'output',
          {
            'aria-live': 'polite',
            'aria-atomic': 'true',
            'data-testid': 'filesystem-operation-status',
            'data-state': pendingOperationCount > 0 ? 'pending' : 'idle',
            className: 'sr-only',
          },
          pendingOperationCount > 0 ? 'Filesystem operation in progress' : null,
        ),
        dialogs.dialog,
      ),
    },
    sharing: {
      sidebarItems: sharingOperations,
    },
  }
}
