import { isPromiseLike } from '../../../../shared/common/async'
import type { MaybePromise } from '../../../../shared/common/async'
import type { FileSystemTransactionId, SidebarItemId } from '../../../../shared/common/ids'
import { assertResourceItemSlug } from '../workspace/items'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'
import type { AnyItem, FolderItem } from '../workspace/items'
import type { ResourceSlug } from '../workspace/resource-contract'

import { normalizeSelectedRoots } from './domain/selection-roots'
import type {
  ResourceDropDriver,
  ResourceHistoryOperationDriver,
  ResourceOperationDriver,
  ResourceCommandDriver,
  ResourceTrashRequestResult,
  ResourceTrashDriver,
} from './operation-runtime-contract'
import type {
  ResourceCommandResult,
  ResourceCreateCommand,
  ResourceCreateParentPlan,
  ResourceEvent,
  ResourceRenameCommand,
  ResourceTransactionReceipt,
} from './transaction-contract'
import type { FileSystemCacheAdapter } from './cache'

type ExecuteFileSystemItemCommand = ResourceCommandDriver['executeCommand']

type DiscardCreatedItem = (transactionId: FileSystemTransactionId) => MaybePromise<void>
type CreateFileSystemHostItemInput = Omit<ResourceCreateCommand, 'type'> & {
  parentPlan?: ResourceCreateParentPlan
}

export type CreatedFileSystemHostItem = {
  id: SidebarItemId
  slug: ResourceSlug
}

export type CreateFileSystemHostItemInitializer = (
  created: CreatedFileSystemHostItem,
) => MaybePromise<void>

export type RenameFileSystemHostItemInput = Omit<ResourceRenameCommand, 'type'>

export type RenamedFileSystemHostItem = {
  slug: ResourceSlug | null
}

function getCompletedReceipt(result: ResourceCommandResult): ResourceTransactionReceipt {
  if (result.status === 'completed') return result.receipt
  throw new Error(`Filesystem command did not complete: ${result.status}`)
}

function getCreatedItemResult(receipt: ResourceTransactionReceipt): {
  id: SidebarItemId
  slug: ResourceSlug
  transactionId: FileSystemTransactionId
} {
  if (!receipt.transactionId) throw new Error('Create item receipt did not include transaction id')
  const created = receipt.events.find(
    (event): event is Extract<ResourceEvent, { type: 'created' }> => event.type === 'created',
  )
  if (!created?.slug) throw new Error('Create item receipt did not include created item')
  return {
    id: created.itemId,
    slug: assertResourceItemSlug(created.slug),
    transactionId: receipt.transactionId,
  }
}

function getReceiptRenamedSlug(receipt: ResourceTransactionReceipt): ResourceSlug | null {
  const renamed = receipt.events.find(
    (event): event is Extract<ResourceEvent, { type: 'renamed' }> => event.type === 'renamed',
  )
  return renamed ? assertResourceItemSlug(renamed.slug) : null
}

type FileSystemItemCommandOperations = {
  createItem: (
    input: CreateFileSystemHostItemInput,
    initialize?: CreateFileSystemHostItemInitializer,
  ) => MaybePromise<CreatedFileSystemHostItem>
  renameItem: (input: RenameFileSystemHostItemInput) => MaybePromise<RenamedFileSystemHostItem>
  toggleBookmarks: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceCommandResult>
  restoreItems: (
    itemIds: Array<SidebarItemId>,
    targetParentId?: SidebarItemId | null,
  ) => MaybePromise<ResourceCommandResult>
  deleteForever: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceCommandResult>
  emptyTrash: () => MaybePromise<ResourceCommandResult>
  trashItems: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceCommandResult>
}

export function createFileSystemItemCommandOperations({
  discardCreatedItem,
  executeCommand,
  finalizeCreatedItem,
}: {
  discardCreatedItem: DiscardCreatedItem
  executeCommand: ExecuteFileSystemItemCommand
  finalizeCreatedItem?: ResourceCommandDriver['finalizeCreatedItem']
}): FileSystemItemCommandOperations {
  return {
    createItem: ({ parentPlan, ...input }, initialize) => {
      const result = executeCommand(
        { type: 'create', ...input },
        parentPlan === undefined ? undefined : { createParentPlan: parentPlan },
      )
      return isPromiseLike(result)
        ? result.then((commandResult) =>
            completeCreatedItem(commandResult, initialize, {
              discardCreatedItem,
              finalizeCreatedItem,
            }),
          )
        : completeCreatedItem(result, initialize, {
            discardCreatedItem,
            finalizeCreatedItem,
          })
    },
    renameItem: (input) => {
      const result = executeCommand({ type: 'rename', ...input })
      return isPromiseLike(result)
        ? result.then((commandResult) => completeRenamedItem(commandResult))
        : completeRenamedItem(result)
    },
    toggleBookmarks: (itemIds) => {
      return executeCommand({ type: 'toggleBookmarks', itemIds })
    },
    trashItems: (itemIds) => {
      return executeCommand({ type: 'trash', itemIds })
    },
    restoreItems: (itemIds, targetParentId = null) => {
      return executeCommand({ type: 'restore', itemIds, targetParentId })
    },
    deleteForever: (itemIds) => {
      return executeCommand({ type: 'deleteForever', itemIds })
    },
    emptyTrash: () => {
      return executeCommand({ type: 'emptyTrash' })
    },
  }
}

function completeCreatedItem(
  result: ResourceCommandResult,
  initialize: CreateFileSystemHostItemInitializer | undefined,
  driver: {
    discardCreatedItem: DiscardCreatedItem
    finalizeCreatedItem?: ResourceCommandDriver['finalizeCreatedItem']
  },
): MaybePromise<CreatedFileSystemHostItem> {
  const receipt = getCompletedReceipt(result)
  const created = getCreatedItemResult(receipt)
  let didDiscard = false
  let discardResult: MaybePromise<void>
  const discardAndThrow = (error: unknown): MaybePromise<never> => {
    if (!didDiscard) {
      didDiscard = true
      discardResult = driver.discardCreatedItem(created.transactionId)
    }
    if (isPromiseLike(discardResult)) {
      return discardResult.then(
        () => {
          throw error
        },
        () => {
          throw error
        },
      )
    }
    throw error
  }
  const complete = (): MaybePromise<CreatedFileSystemHostItem> => {
    const finalized = driver.finalizeCreatedItem?.(created.transactionId)
    if (isPromiseLike(finalized)) {
      return finalized.then(() => ({ id: created.id, slug: created.slug }))
    }
    return { id: created.id, slug: created.slug }
  }
  try {
    const initialized = initialize?.({ id: created.id, slug: created.slug })
    const completeWithRollback = (): MaybePromise<CreatedFileSystemHostItem> => {
      try {
        const completed = complete()
        if (isPromiseLike(completed)) {
          return completed.then((createdItem) => createdItem, discardAndThrow)
        }
        return completed
      } catch (error) {
        return discardAndThrow(error)
      }
    }
    if (isPromiseLike(initialized)) {
      return initialized.then(completeWithRollback, discardAndThrow)
    }
    return completeWithRollback()
  } catch (error) {
    return discardAndThrow(error)
  }
}

function completeRenamedItem(result: ResourceCommandResult): RenamedFileSystemHostItem {
  const receipt = getCompletedReceipt(result)
  return { slug: getReceiptRenamedSlug(receipt) }
}

export function createResourceCommandDrivers(
  commandDriver: ResourceCommandDriver,
  trashDialogs: Pick<ResourceTrashDriver, 'confirmDeleteForever' | 'confirmEmptyTrash'>,
): {
  dropDriver: ResourceDropDriver
  historyDriver: ResourceHistoryOperationDriver
  operationDriver: ResourceOperationDriver
  trashDriver: ResourceTrashDriver
} {
  const {
    deleteForever: _deleteForever,
    emptyTrash: _emptyTrash,
    restoreItems,
    trashItems,
    ...operationDriver
  } = createFileSystemItemCommandOperations({
    discardCreatedItem: commandDriver.discardCreatedItem,
    executeCommand: commandDriver.executeCommand,
    finalizeCreatedItem: commandDriver.finalizeCreatedItem,
  })

  return {
    operationDriver,
    dropDriver: {
      executeDropCommand: (command) => commandDriver.executeCommand(command),
    },
    historyDriver: {
      undo: commandDriver.undo,
      redo: commandDriver.redo,
      canUndo: commandDriver.canUndo,
      canRedo: commandDriver.canRedo,
    },
    trashDriver: {
      requestTrashItems: trashItems,
      restoreItems,
      confirmDeleteForever: trashDialogs.confirmDeleteForever,
      confirmEmptyTrash: trashDialogs.confirmEmptyTrash,
    },
  }
}

type FileSystemTrashDialogOperations = {
  confirmDeleteForever: (itemIds: Array<SidebarItemId>) => void
  confirmEmptyTrash: () => void
  requestTrashItems: (itemIds: Array<SidebarItemId>) => Promise<ResourceTrashRequestResult>
}

export function createFileSystemTrashDialogOperations({
  cacheAdapter,
  dialogs,
  trashItems,
}: {
  cacheAdapter: FileSystemCacheAdapter
  dialogs: {
    requestDeleteForever: (items: Array<AnyItem>) => void
    requestEmptyTrash: () => void
    requestTrashFolder: (folder: FolderItem) => void
  }
  trashItems: (itemIds: Array<SidebarItemId>) => MaybePromise<ResourceTrashRequestResult>
}): FileSystemTrashDialogOperations {
  const normalizeOperationItems = (items: Array<AnyItem>, model = cacheAdapter.getReadModel()) =>
    normalizeSelectedRoots(items, model.itemsById)

  return {
    requestTrashItems: async (itemIds) => {
      const currentReadModel = cacheAdapter.getReadModel()
      const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
      if (items.length === 0) return { status: 'noop', reason: 'no_items' }
      const nonEmptyFolder = items.find(
        (item): item is FolderItem =>
          item.type === RESOURCE_TYPES.folders &&
          currentReadModel.getActiveChildren(item.id).length > 0,
      )
      if (nonEmptyFolder) {
        dialogs.requestTrashFolder(nonEmptyFolder)
        return { status: 'pending', reason: 'folder_confirmation_required' }
      }
      return await trashItems(items.map((item) => item.id))
    },
    confirmDeleteForever: (itemIds) => {
      const currentReadModel = cacheAdapter.getReadModel()
      const items = normalizeOperationItems(currentReadModel.getItems(itemIds), currentReadModel)
      if (items.length === 0) return
      dialogs.requestDeleteForever(items)
    },
    confirmEmptyTrash: () => {
      dialogs.requestEmptyTrash()
    },
  }
}
