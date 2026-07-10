import { isPromiseLike } from '../../../../shared/common/async'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceImportContentInitializers } from '../files/import-contract'
import {
  assertResourceItemName,
  deduplicateName,
  normalizeResourceItemNameForComparison,
  validateResourceItemNameWithSiblings,
} from '../workspace/items'
import type { AnyItem, ValidationResult } from '../workspace/items'
import type {
  ResourceColor,
  ResourceName,
  ResourceSlug,
  ResourceIconName,
  ResourceKind,
} from '../workspace/resource-contract'
import { RESOURCE_TYPES } from '../workspace/items-persistence-contract'

import {
  coerceSidebarItemColorForInput,
  coerceSidebarItemIconNameForInput,
} from '../workspace/items/appearance'
import {
  planCreateParentTarget,
  validateCreateParentTarget,
} from '../workspace/items/create-parent-target'
import { findUniqueDefaultName } from '../workspace/items/default-names'
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
  FileSystemItemNameValidation,
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
  navigateToItem: (
    slug: ResourceSlug,
    options?: { heading?: string; replace?: boolean },
  ) => Promise<unknown> | void
  onItemSlugChange?: (itemId: SidebarItemId, slug: ResourceSlug | null) => void
  reportCreateItemError: (error: unknown, message: string) => void
  setLastSelectedItem?: (slug: ResourceSlug) => void
}

type OptimisticCreatedItems = {
  folderIds: Set<SidebarItemId>
  itemsById: Map<
    SidebarItemId,
    {
      name: ResourceName
      parentKey: string
      type: ResourceKind
    }
  >
}

type ActiveCreateScopes = Array<Set<SidebarItemId>>

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
    catalog,
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
  const activeCreateScopes: ActiveCreateScopes = []
  return (input, initialize) =>
    createWorkspaceItemWithScope({
      activeCreateScopes,
      canCreateItems,
      canManageFolders,
      catalog,
      filesystem,
      initialize,
      input,
      onItemSlugChange,
      optimisticCreatedItems,
      reportCreateItemError,
    })
}

type WorkspaceCreateItemInput = Parameters<FileSystemCreateItem>[0]
type WorkspaceCreateItemInitializer = Parameters<FileSystemCreateItem>[1]
type WorkspaceCreateItemResult = ReturnType<FileSystemCreateItem>
type CreatedRuntimeItem = Awaited<ReturnType<ResourceOperationDriver['createItem']>>

type CreateItemScope = {
  activate: () => void
  deactivate: () => void
  discard: () => void
}

function createWorkspaceItemWithScope({
  activeCreateScopes,
  canCreateItems,
  canManageFolders,
  catalog,
  filesystem,
  initialize,
  input,
  onItemSlugChange,
  optimisticCreatedItems,
  reportCreateItemError,
}: {
  activeCreateScopes: ActiveCreateScopes
  canCreateItems: boolean
  canManageFolders: boolean
  catalog: ResourceCatalog
  filesystem: ResourceOperationDriver
  initialize: WorkspaceCreateItemInitializer
  input: WorkspaceCreateItemInput
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  optimisticCreatedItems: OptimisticCreatedItems
  reportCreateItemError: WorkspaceFileSystemOperationsInput['reportCreateItemError']
}): WorkspaceCreateItemResult {
  if (!canCreateItems) return { status: 'unavailable', reason: 'create_items_unsupported' }

  const scope = createItemScope(activeCreateScopes, optimisticCreatedItems, onItemSlugChange)
  scope.activate()
  try {
    const request = createWorkspaceItemRequest({ catalog, input, optimisticCreatedItems })
    if (!canCreatePlannedItem(input.type, request.parentPlan, canManageFolders)) {
      scope.deactivate()
      return { status: 'unavailable', reason: 'manage_folders_unsupported' }
    }
    const recordCreatedItem = createCreatedItemRecorder({
      activeCreateScopes,
      name: request.name,
      onItemSlugChange,
      optimisticCreatedItems,
      parentKey: request.parentKey,
      type: input.type,
    })
    const created = initialize
      ? filesystem.createItem(request.commandInput, (createdItem) => {
          recordCreatedItem(createdItem)
          return initialize({ status: 'completed', id: createdItem.id, slug: createdItem.slug })
        })
      : filesystem.createItem(request.commandInput)

    return completeWorkspaceItemCreate(created, {
      recordCreatedItem,
      reportCreateItemError,
      scope,
    })
  } catch (error) {
    scope.discard()
    scope.deactivate()
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
  activeCreateScopes: ActiveCreateScopes,
  optimisticCreatedItems: OptimisticCreatedItems,
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange'],
): CreateItemScope {
  const createScope = new Set<SidebarItemId>()
  let scopeIsActive = false
  return {
    activate: () => {
      activeCreateScopes.push(createScope)
      scopeIsActive = true
    },
    deactivate: () => {
      if (!scopeIsActive) return
      const index = activeCreateScopes.lastIndexOf(createScope)
      if (index >= 0) activeCreateScopes.splice(index, 1)
      scopeIsActive = false
    },
    discard: () => {
      for (const createdItemId of [...createScope].reverse()) {
        removeOptimisticCreatedItem(optimisticCreatedItems, { createdItemId })
        onItemSlugChange?.(createdItemId, null)
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

function createCreatedItemRecorder({
  activeCreateScopes,
  name,
  onItemSlugChange,
  optimisticCreatedItems,
  parentKey,
  type,
}: {
  activeCreateScopes: ActiveCreateScopes
  name: ResourceName
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  optimisticCreatedItems: OptimisticCreatedItems
  parentKey: string
  type: ResourceKind
}) {
  let recordedResult: FileSystemCreateItemCompletedResult | null = null
  return (createdItem: CreatedRuntimeItem): FileSystemCreateItemCompletedResult => {
    if (recordedResult) return recordedResult
    for (const scope of activeCreateScopes) {
      scope.add(createdItem.id)
    }
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
    scope.deactivate()
    return result
  }

  return created
    .then(recordCreatedItem, (error: unknown) => {
      scope.discard()
      reportCreateItemError(error, 'Failed to create item')
      return { status: 'failed' as const, reason: 'create_failed' as const, error }
    })
    .then(
      (result) => {
        scope.deactivate()
        return result
      },
      (error: unknown) => {
        scope.deactivate()
        throw error
      },
    )
}

function recordOptimisticCreatedItem(
  optimisticCreatedItems: OptimisticCreatedItems,
  {
    createdItemId,
    name,
    parentKey,
    type,
  }: {
    createdItemId: SidebarItemId
    name: ResourceName
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
  { createdItemId }: { createdItemId: SidebarItemId },
) {
  const item = optimisticCreatedItems.itemsById.get(createdItemId)
  if (!item) return
  optimisticCreatedItems.itemsById.delete(createdItemId)
  if (item.type === RESOURCE_TYPES.folders) {
    optimisticCreatedItems.folderIds.delete(createdItemId)
  }
}

function createWorkspaceUpdateItemMetadataOperation({
  catalog,
  currentItem,
  filesystem,
  navigateToItem,
  onItemSlugChange,
  setLastSelectedItem,
}: {
  catalog: ResourceCatalog
  currentItem: AnyItem | null
  filesystem: ResourceOperationDriver
  navigateToItem: WorkspaceFileSystemOperationsInput['navigateToItem']
  onItemSlugChange: WorkspaceFileSystemOperationsInput['onItemSlugChange']
  setLastSelectedItem: WorkspaceFileSystemOperationsInput['setLastSelectedItem']
}): FileSystemUpdateItemMetadata {
  return async ({ color, iconName, item, name }) => {
    const trimmedName = name === undefined ? undefined : name.trim()
    if (trimmedName !== undefined) {
      const result = validateRuntimeItemName(catalog, trimmedName, item.parentId, item.id)
      if (!result.valid) throw new Error(result.error)
    }
    const metadataUpdate = normalizeRuntimeMetadataUpdate({ color, iconName, name: trimmedName })
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
    } catch {
      throw new Error('Failed to update item metadata')
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
  name?: ResourceName
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
    name: name === undefined ? undefined : assertResourceItemName(name),
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
    validateItemName: (name, parentId, excludeId) =>
      validateRuntimeItemName(catalog, name, parentId, excludeId),
    validateCreateItem: ({ name, parentTarget }) =>
      validateCreateItemLocally(
        { name, parentTarget },
        {
          getItemById: catalog.getKnownItemById,
          getActiveChildren: catalog.getVisibleChildren,
        },
      ),
  } satisfies Pick<FileSystemOperations, 'validateCreateItem' | 'validateItemName'>
}

function getContextMenuPasteParentId({
  clickedItem,
}: FileSystemHostPasteTargetInput): SidebarItemId | null | undefined {
  if (clickedItem?.type === RESOURCE_TYPES.folders) return clickedItem.id
  return clickedItem ? clickedItem.parentId : undefined
}

function validateRuntimeItemName(
  catalog: ResourceCatalog,
  name: string,
  parentId: Parameters<FileSystemItemNameValidation>[1],
  excludeId?: Parameters<FileSystemItemNameValidation>[2],
): ValidationResult {
  return validateResourceItemNameWithSiblings(name, catalog.getVisibleChildren(parentId), excludeId)
}

function resolveCreateItemName({
  catalog,
  name,
  optimisticCreatedItems,
  parentTarget,
  type,
}: FileSystemCreateItemInput & {
  catalog: ResourceCatalog
  optimisticCreatedItems: OptimisticCreatedItems
}): {
  name: ResourceName
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
  const parentId = getPlannedExistingParentId(parentPlan)
  const existingSiblingNames =
    parentId === undefined
      ? []
      : validationSource.getActiveChildren(parentId).map((item) => item.name)
  const optimisticSiblingNames = Array.from(optimisticCreatedItems.itemsById.values())
    .filter((item) => item.parentKey === parentKey)
    .map((item) => item.name)
  const siblingNames = [...existingSiblingNames, ...optimisticSiblingNames]
  const candidateName =
    name?.trim() ||
    findUniqueDefaultName(
      type,
      siblingNames.map((siblingName) => ({ name: assertResourceItemName(siblingName) })),
    )
  const dedupedName = deduplicateName(candidateName, siblingNames)
  return { name: assertResourceItemName(dedupedName), parentKey, parentPlan }
}

function getPlannedExistingParentId(
  plan: NonNullable<ReturnType<typeof planCreateParentTarget>>,
): SidebarItemId | null | undefined {
  if (plan.kind === 'direct') return plan.parentId
  const finalFolder = plan.folders.at(-1)
  if (!finalFolder) return null
  return finalFolder.kind === 'existing' ? finalFolder.id : undefined
}

function createOptimisticParentKey(plan: NonNullable<ReturnType<typeof planCreateParentTarget>>) {
  if (plan.kind === 'direct') return createExistingParentKey(plan.parentId)

  let key = createExistingParentKey(null)
  for (const folder of plan.folders) {
    key =
      folder.kind === 'existing'
        ? createExistingParentKey(folder.id)
        : `${key}/path:${normalizeResourceItemNameForComparison(folder.name)}`
  }
  return key
}

function createExistingParentKey(parentId: SidebarItemId | null) {
  return `id:${parentId ?? 'root'}`
}
