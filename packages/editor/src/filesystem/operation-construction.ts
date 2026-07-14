import type { ResourceId } from '../resources/domain-id'
import { isPromiseLike } from '../../../../shared/common/async'

import type { ResourceImportContentInitializers } from '../files/import-contract'
import { canonicalizeResourceItemTitle } from '../workspace/items'
import type { AnyItem } from '../workspace/items'
import type {
  ResourceColor,
  ResourceSlug,
  ResourceIconName,
  ResourceKind,
} from '../workspace/resource-contract'
import type { ResourceTitle } from '../resources/resource-contract'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'

import {
  coerceSidebarItemColorForInput,
  coerceSidebarItemIconNameForInput,
} from '../workspace/items/appearance'
import {
  planCreateParentTarget,
  validateCreateParentTarget,
} from '../workspace/items/create-parent-target'
import { validateCreateItemLocally } from '../workspace/items/local-create-validation'
import type { ResourceCatalog } from './catalog'
import { evaluateCreateItem } from './domain/operation-capabilities'
import { importWorkspaceFile, importWorkspaceFileDrop } from './import'
import type {
  FileSystemClipboardOperations,
  FileSystemCreateItem,
  FileSystemCreateItemCompletedResult,
  FileSystemCreateItemInput,
  ResourceImportFileOperation,
  FileSystemUpdateItemMetadata,
} from './item-operation-contracts'
import type { FileSystemOperations } from './operations'
import type {
  ResourceClipboardDriver,
  ResourceCommandCapabilities,
  ResourceIoCapabilities,
  ResourceDropDriver,
  ResourceHistoryOperationDriver,
  ResourceOperationDriver,
  ResourceTrashDriver,
} from './operation-runtime-contract'

type FileSystemHostPasteTargetInput = {
  clickedItem?: AnyItem
}

type NavigateToWorkspaceItem = (
  slug: ResourceSlug,
  options?: { heading?: string; replace?: boolean },
) => Promise<unknown> | void

type ResourceSlugChangeListener = (itemId: ResourceId, slug: ResourceSlug | null) => void
type CreateItemErrorReporter = (error: unknown, message: string) => void
type LastSelectedItemWriter = (slug: ResourceSlug) => void

type WorkspaceFileSystemOperationsInput = {
  capabilities: ResourceCommandCapabilities
  catalog: ResourceCatalog
  clipboardDriver: ResourceClipboardDriver
  contentInitializers: ResourceImportContentInitializers
  currentItem: AnyItem | null
  dropDriver: ResourceDropDriver
  historyDriver?: ResourceHistoryOperationDriver
  ioCapabilities?: ResourceIoCapabilities
  operationDriver: ResourceOperationDriver
  trashDriver: ResourceTrashDriver
  navigateToItem: NavigateToWorkspaceItem
  onItemSlugChange?: ResourceSlugChangeListener
  reportCreateItemError: CreateItemErrorReporter
  setLastSelectedItem?: LastSelectedItemWriter
}

type OptimisticCreatedItems = {
  folderIds: Set<ResourceId>
  itemsById: Map<
    ResourceId,
    {
      name: ResourceTitle
      parentKey: string
      type: ResourceKind
    }
  >
}

function createOptimisticCreatedItems(): OptimisticCreatedItems {
  return {
    folderIds: new Set(),
    itemsById: new Map(),
  }
}

export function createWorkspaceFileSystemOperations({
  capabilities,
  catalog,
  clipboardDriver,
  contentInitializers,
  currentItem,
  dropDriver,
  historyDriver = UNAVAILABLE_FILE_SYSTEM_HISTORY_DRIVER,
  ioCapabilities = {},
  operationDriver,
  trashDriver,
  navigateToItem,
  onItemSlugChange,
  reportCreateItemError,
  setLastSelectedItem,
}: WorkspaceFileSystemOperationsInput): FileSystemOperations {
  const optimisticCreatedItems = createOptimisticCreatedItems()
  const canCreateItems = isOperationCapabilityAvailable(capabilities.createItems)
  const canManageFolders = isOperationCapabilityAvailable(capabilities.manageFolders)
  const createWorkspaceItem = createWorkspaceCreateItemOperation({
    canCreateItems,
    canManageFolders,
    catalog,
    filesystem: operationDriver,
    onItemSlugChange,
    optimisticCreatedItems,
    reportCreateItemError,
  })
  const updateItemMetadata = createWorkspaceUpdateItemMetadataOperation({
    currentItem,
    filesystem: operationDriver,
    navigateToItem,
    onItemSlugChange,
    setLastSelectedItem,
  })
  const importFile: ResourceImportFileOperation = (input) =>
    importWorkspaceFile({
      catalog,
      createItem: createWorkspaceItem,
      initializers: contentInitializers,
      input,
      maxUploadBytes: ioCapabilities.maxUploadBytes,
    })

  return createWorkspaceFileSystemOperationSet({
    catalog,
    clipboardDriver,
    createWorkspaceItem,
    dropDriver,
    filesystem: operationDriver,
    historyDriver,
    importFile,
    trashDriver,
    updateItemMetadata,
  })
}

function isOperationCapabilityAvailable(
  capability: ResourceCommandCapabilities[keyof ResourceCommandCapabilities],
) {
  return capability.status === 'available'
}

const UNAVAILABLE_FILE_SYSTEM_HISTORY_DRIVER: ResourceHistoryOperationDriver = {
  canUndo: false,
  canRedo: false,
  undo: () => ({ status: 'unavailable', reason: 'history_unsupported' }),
  redo: () => ({ status: 'unavailable', reason: 'history_unsupported' }),
}

function createWorkspaceCreateItemOperation({
  canCreateItems,
  canManageFolders,
  catalog,
  filesystem,
  onItemSlugChange,
  optimisticCreatedItems,
  reportCreateItemError,
}: {
  canCreateItems: boolean
  canManageFolders: boolean
  catalog: ResourceCatalog
  filesystem: ResourceOperationDriver
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  optimisticCreatedItems: OptimisticCreatedItems
  reportCreateItemError: WorkspaceFileSystemOperationsInput['reportCreateItemError']
}): FileSystemCreateItem {
  return (input, initialize) =>
    createWorkspaceItemWithScope({
      canCreateItems,
      canManageFolders,
      catalog,
      filesystem,
      initialize,
      input,
      onItemSlugChange,
      optimisticCreatedItems,
      ownerScope: null,
      reportCreateItemError,
    })
}

type WorkspaceCreateItemInput = Parameters<FileSystemCreateItem>[0]
type WorkspaceCreateItemInitializer = Parameters<FileSystemCreateItem>[1]
type WorkspaceCreateItemResult = ReturnType<FileSystemCreateItem>
type CreatedRuntimeItem = Awaited<ReturnType<ResourceOperationDriver['createItem']>>

type CreateItemScope = {
  discard: () => void
  forget: (itemId: ResourceId) => void
  record: (itemId: ResourceId) => void
}

function createWorkspaceItemWithScope({
  canCreateItems,
  canManageFolders,
  catalog,
  filesystem,
  initialize,
  input,
  onItemSlugChange,
  optimisticCreatedItems,
  ownerScope,
  reportCreateItemError,
}: {
  canCreateItems: boolean
  canManageFolders: boolean
  catalog: ResourceCatalog
  filesystem: ResourceOperationDriver
  initialize: WorkspaceCreateItemInitializer
  input: WorkspaceCreateItemInput
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  optimisticCreatedItems: OptimisticCreatedItems
  ownerScope: CreateItemScope | null
  reportCreateItemError: WorkspaceFileSystemOperationsInput['reportCreateItemError']
}): WorkspaceCreateItemResult {
  if (!canCreateItems) return { status: 'unavailable', reason: 'create_items_unsupported' }

  const scope = createItemScope(optimisticCreatedItems, onItemSlugChange, ownerScope)
  try {
    const request = createWorkspaceItemRequest({ catalog, input, optimisticCreatedItems })
    if (!canCreatePlannedItem(input.type, request.parentPlan, canManageFolders)) {
      return { status: 'unavailable', reason: 'manage_folders_unsupported' }
    }
    const recordCreatedItem = createCreatedItemRecorder({
      name: request.name,
      onItemSlugChange,
      optimisticCreatedItems,
      parentKey: request.parentKey,
      scope,
      type: input.type,
    })
    const created = initialize
      ? filesystem.createItem(request.commandInput, (createdItem) => {
          recordCreatedItem(createdItem)
          const createNestedItem: FileSystemCreateItem = (nestedInput, nestedInitialize) =>
            createWorkspaceItemWithScope({
              canCreateItems,
              canManageFolders,
              catalog,
              filesystem,
              initialize: nestedInitialize,
              input: nestedInput,
              onItemSlugChange,
              optimisticCreatedItems,
              ownerScope: scope,
              reportCreateItemError,
            })
          return initialize(
            { status: 'completed', id: createdItem.id, slug: createdItem.slug },
            createNestedItem,
          )
        })
      : filesystem.createItem(request.commandInput)

    return completeWorkspaceItemCreate(created, {
      recordCreatedItem,
      reportCreateItemError,
      scope,
    })
  } catch (error) {
    scope.discard()
    reportCreateItemError(error, 'Failed to create item')
    return { status: 'failed', reason: 'create_failed', error }
  }
}

function canCreatePlannedItem(
  itemType: ResourceKind,
  parentPlan: NonNullable<ReturnType<typeof planCreateParentTarget>>,
  canManageFolders: boolean,
) {
  const actor = { canManageFolders }
  if (!evaluateCreateItem(actor, itemType).ok) return false
  if (parentPlan.kind !== 'path') return true
  const createsParentFolder = parentPlan.folders.some((folder) => folder.kind === 'virtual')
  return !createsParentFolder || evaluateCreateItem(actor, RESOURCE_TYPES.folders).ok
}

function createItemScope(
  optimisticCreatedItems: OptimisticCreatedItems,
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange'],
  ownerScope: CreateItemScope | null,
): CreateItemScope {
  const createScope = new Set<ResourceId>()
  return {
    record: (itemId) => {
      createScope.add(itemId)
      ownerScope?.record(itemId)
    },
    forget: (itemId) => {
      createScope.delete(itemId)
      ownerScope?.forget(itemId)
    },
    discard: () => {
      for (const createdItemId of [...createScope].reverse()) {
        removeOptimisticCreatedItem(optimisticCreatedItems, { createdItemId })
        onItemSlugChange?.(createdItemId, null)
        ownerScope?.forget(createdItemId)
      }
      createScope.clear()
    },
  }
}

function createWorkspaceItemRequest({
  catalog,
  input,
  optimisticCreatedItems,
}: {
  catalog: ResourceCatalog
  input: WorkspaceCreateItemInput
  optimisticCreatedItems: OptimisticCreatedItems
}) {
  reconcilePersistedOptimisticCreatedItems(catalog, optimisticCreatedItems)
  const { color, iconName, name, parentTarget, type } = input
  const resolved = resolveCreateItemName({
    catalog,
    name,
    optimisticCreatedItems,
    parentTarget,
    type,
  })
  return {
    name: resolved.name,
    parentKey: resolved.parentKey,
    parentPlan: resolved.parentPlan,
    commandInput: {
      itemType: type,
      name: resolved.name,
      parentTarget,
      ...(resolved.parentPlan.kind === 'path' ? { parentPlan: resolved.parentPlan } : {}),
      ...(iconName === undefined ? {} : { iconName: coerceSidebarItemIconNameForInput(iconName) }),
      ...(color === undefined ? {} : { color: coerceSidebarItemColorForInput(color) }),
    },
  }
}

function reconcilePersistedOptimisticCreatedItems(
  catalog: ResourceCatalog,
  optimisticCreatedItems: OptimisticCreatedItems,
) {
  for (const createdItemId of optimisticCreatedItems.itemsById.keys()) {
    if (!catalog.getKnownItemById(createdItemId)) continue
    removeOptimisticCreatedItem(optimisticCreatedItems, { createdItemId })
  }
}

function createCreatedItemRecorder({
  name,
  onItemSlugChange,
  optimisticCreatedItems,
  parentKey,
  scope,
  type,
}: {
  name: ResourceTitle
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  optimisticCreatedItems: OptimisticCreatedItems
  parentKey: string
  scope: CreateItemScope
  type: ResourceKind
}) {
  let recordedResult: FileSystemCreateItemCompletedResult | null = null
  return (createdItem: CreatedRuntimeItem): FileSystemCreateItemCompletedResult => {
    if (recordedResult) return recordedResult
    scope.record(createdItem.id)
    recordOptimisticCreatedItem(optimisticCreatedItems, {
      createdItemId: createdItem.id,
      name,
      parentKey,
      type,
    })
    onItemSlugChange?.(createdItem.id, createdItem.slug)
    recordedResult = { status: 'completed', id: createdItem.id, slug: createdItem.slug }
    return recordedResult
  }
}

function completeWorkspaceItemCreate(
  created: CreatedRuntimeItem | PromiseLike<CreatedRuntimeItem>,
  {
    recordCreatedItem,
    reportCreateItemError,
    scope,
  }: {
    recordCreatedItem: (createdItem: CreatedRuntimeItem) => FileSystemCreateItemCompletedResult
    reportCreateItemError: WorkspaceFileSystemOperationsInput['reportCreateItemError']
    scope: CreateItemScope
  },
): WorkspaceCreateItemResult {
  if (!isPromiseLike(created)) {
    const result = recordCreatedItem(created)
    return result
  }

  return created.then(recordCreatedItem, (error: unknown) => {
    scope.discard()
    reportCreateItemError(error, 'Failed to create item')
    return { status: 'failed' as const, reason: 'create_failed' as const, error }
  })
}

function recordOptimisticCreatedItem(
  optimisticCreatedItems: OptimisticCreatedItems,
  {
    createdItemId,
    name,
    parentKey,
    type,
  }: {
    createdItemId: ResourceId
    name: ResourceTitle
    parentKey: string
    type: ResourceKind
  },
) {
  if (optimisticCreatedItems.itemsById.has(createdItemId)) return
  optimisticCreatedItems.itemsById.set(createdItemId, { name, parentKey, type })
  if (type === RESOURCE_TYPES.folders) {
    optimisticCreatedItems.folderIds.add(createdItemId)
  }
}

function removeOptimisticCreatedItem(
  optimisticCreatedItems: OptimisticCreatedItems,
  { createdItemId }: { createdItemId: ResourceId },
) {
  const item = optimisticCreatedItems.itemsById.get(createdItemId)
  if (!item) return
  optimisticCreatedItems.itemsById.delete(createdItemId)
  if (item.type === RESOURCE_TYPES.folders) {
    optimisticCreatedItems.folderIds.delete(createdItemId)
  }
}

function createWorkspaceUpdateItemMetadataOperation({
  currentItem,
  filesystem,
  navigateToItem,
  onItemSlugChange,
  setLastSelectedItem,
}: {
  currentItem: AnyItem | null
  filesystem: ResourceOperationDriver
  navigateToItem: WorkspaceFileSystemOperationsInput['navigateToItem']
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  setLastSelectedItem: WorkspaceFileSystemOperationsInput['setLastSelectedItem']
}): FileSystemUpdateItemMetadata {
  return async ({ color, iconName, item, name }) => {
    const metadataUpdate = normalizeRuntimeMetadataUpdate({ color, iconName, name })
    if (!metadataUpdate || !hasRuntimeMetadataChange(item, metadataUpdate)) {
      return { slug: item.slug }
    }

    let update: Awaited<ReturnType<ResourceOperationDriver['renameItem']>>
    try {
      update = await filesystem.renameItem({
        itemId: item.id,
        name: metadataUpdate.name,
        iconName: metadataUpdate.iconName,
        color: metadataUpdate.color,
      })
    } catch (error) {
      throw new Error('Failed to update item metadata', { cause: error })
    }
    const slug = update.slug ?? item.slug
    onItemSlugChange?.(item.id, slug)

    if (currentItem?.id === item.id && slug !== item.slug) {
      setLastSelectedItem?.(slug)
      await Promise.resolve(navigateToItem(slug, { replace: true })).catch(() => undefined)
    }

    return { slug }
  }
}

type RuntimeMetadataUpdateInput = {
  name?: string
  iconName?: string | null
  color?: string | null
}

type NormalizedRuntimeMetadataUpdate = {
  name?: ResourceTitle
  iconName?: ResourceIconName | null
  color?: ResourceColor | null
}

function normalizeRuntimeMetadataUpdate({
  color,
  iconName,
  name,
}: RuntimeMetadataUpdateInput): NormalizedRuntimeMetadataUpdate | null {
  if (name === undefined && iconName === undefined && color === undefined) return null
  return {
    name: name === undefined ? undefined : canonicalizeResourceItemTitle(name),
    iconName:
      iconName === undefined || iconName === null
        ? iconName
        : coerceSidebarItemIconNameForInput(iconName),
    color: color === undefined || color === null ? color : coerceSidebarItemColorForInput(color),
  }
}

function hasRuntimeMetadataChange(item: AnyItem, update: NormalizedRuntimeMetadataUpdate) {
  return (
    (update.name !== undefined && update.name !== item.name) ||
    (update.iconName !== undefined && update.iconName !== item.iconName) ||
    (update.color !== undefined && update.color !== item.color)
  )
}

function createWorkspaceFileSystemOperationSet({
  catalog,
  clipboardDriver,
  createWorkspaceItem,
  dropDriver,
  filesystem,
  historyDriver,
  importFile,
  trashDriver,
  updateItemMetadata,
}: {
  catalog: ResourceCatalog
  clipboardDriver: ResourceClipboardDriver
  createWorkspaceItem: FileSystemCreateItem
  dropDriver: ResourceDropDriver
  filesystem: ResourceOperationDriver
  historyDriver: ResourceHistoryOperationDriver
  importFile: ResourceImportFileOperation
  trashDriver: ResourceTrashDriver
  updateItemMetadata: FileSystemUpdateItemMetadata
}): FileSystemOperations {
  const pasteTargetOperations = createPasteTargetOperations(clipboardDriver)

  return {
    clipboard: createClipboardOperations(clipboardDriver),
    history: historyDriver,
    createItem: createWorkspaceItem,
    updateItemMetadata,
    executeDropCommand: dropDriver.executeDropCommand,
    toggleBookmarks: filesystem.toggleBookmarks,
    trashItems: trashDriver.requestTrashItems,
    restoreItems: trashDriver.restoreItems,
    requestDeleteItemsForever: (itemIds) => {
      trashDriver.confirmDeleteForever(itemIds)
    },
    requestEmptyTrash: trashDriver.confirmEmptyTrash,
    ...pasteTargetOperations,
    importFile,
    importDrop: createImportDropOperation({ catalog, createWorkspaceItem, importFile }),
    ...createFileSystemValidationOperations(catalog),
  } satisfies FileSystemOperations
}

function createClipboardOperations(
  clipboardDriver: ResourceClipboardDriver,
): FileSystemClipboardOperations {
  return clipboardDriver.canUseClipboardOperations
    ? {
        status: 'available',
        canPaste: clipboardDriver.canPaste(),
        cancel: clipboardDriver.cancelClipboard,
        copyItems: clipboardDriver.copy,
        cutItems: clipboardDriver.cut,
        paste: clipboardDriver.paste,
      }
    : { status: 'unsupported' }
}

function createPasteTargetOperations(clipboardDriver: ResourceClipboardDriver) {
  return {
    canPasteIntoTarget: (input: FileSystemHostPasteTargetInput) => {
      const parentId = getContextMenuPasteParentId(input)
      return clipboardDriver.canPaste(parentId)
    },
    pasteIntoTarget: (input: FileSystemHostPasteTargetInput) => {
      const parentId = getContextMenuPasteParentId(input)
      return clipboardDriver.paste(parentId)
    },
  }
}

function createImportDropOperation({
  catalog,
  createWorkspaceItem,
  importFile,
}: {
  catalog: ResourceCatalog
  createWorkspaceItem: FileSystemCreateItem
  importFile: ResourceImportFileOperation
}) {
  return (input: Parameters<FileSystemOperations['importDrop']>[0]) =>
    importWorkspaceFileDrop({
      catalog,
      input,
      operations: {
        createItem: createWorkspaceItem,
        importFile,
      },
    })
}

function createFileSystemValidationOperations(catalog: ResourceCatalog) {
  return {
    validateCreateItem: ({ name, parentTarget }) =>
      validateCreateItemLocally(
        { name, parentTarget },
        {
          getItemById: catalog.getKnownItemById,
          getActiveChildren: catalog.getVisibleChildren,
        },
      ),
  } satisfies Pick<FileSystemOperations, 'validateCreateItem'>
}

function getContextMenuPasteParentId({
  clickedItem,
}: FileSystemHostPasteTargetInput): ResourceId | null | undefined {
  if (clickedItem?.type === RESOURCE_TYPES.folders) return clickedItem.id
  return clickedItem ? clickedItem.parentId : undefined
}

function resolveCreateItemName({
  catalog,
  name,
  optimisticCreatedItems,
  parentTarget,
}: FileSystemCreateItemInput & {
  catalog: ResourceCatalog
  optimisticCreatedItems: OptimisticCreatedItems
}): {
  name: ResourceTitle
  parentKey: string
  parentPlan: NonNullable<ReturnType<typeof planCreateParentTarget>>
} {
  const validationSource = {
    getItemById: catalog.getKnownItemById,
    getActiveChildren: catalog.getVisibleChildren,
  }
  const parentPlan = planCreateParentTarget(parentTarget, validationSource, {
    createdFolderIds: optimisticCreatedItems.folderIds,
  })
  if (!parentPlan) {
    const parentResult = validateCreateParentTarget(parentTarget, validationSource)
    throw new Error(parentResult.valid ? 'Parent not found' : parentResult.error)
  }
  const parentKey = createOptimisticParentKey(parentPlan)
  return { name: canonicalizeResourceItemTitle(name ?? ''), parentKey, parentPlan }
}

function createOptimisticParentKey(plan: NonNullable<ReturnType<typeof planCreateParentTarget>>) {
  if (plan.kind === 'direct') return createExistingParentKey(plan.parentId)

  let key = createExistingParentKey(null)
  for (const folder of plan.folders) {
    key =
      folder.kind === 'existing' ? createExistingParentKey(folder.id) : `${key}/path:${folder.name}`
  }
  return key
}

function createExistingParentKey(parentId: ResourceId | null) {
  return `id:${parentId ?? 'root'}`
}
