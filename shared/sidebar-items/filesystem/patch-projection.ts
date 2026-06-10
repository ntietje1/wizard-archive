import type { SidebarItemId, UserProfileId } from '../../common/ids'
import type { SidebarItemPatchRow } from './types'
import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../types'
import type { FileSystemPatch } from './receipts'
import { diffSidebarItemFields } from './patches'
import type { TransferOperation } from './transfer-planner'
import { collectDescendantIdsFromItems } from './tree'

type PatchProjectionItem = Extract<FileSystemPatch, { type: 'upsertSidebarItem' }>['item']

type FileSystemPatchSnapshot<T> = {
  items: Array<T>
}

type OptimisticPatchPair = {
  forwardPatches: Array<FileSystemPatch>
  inversePatches: Array<FileSystemPatch>
}

function emptyPatchPair(): OptimisticPatchPair {
  return { forwardPatches: [], inversePatches: [] }
}

function updatePatch<T extends SidebarItemPatchRow>(
  item: T,
  after: Partial<T>,
): { forward: FileSystemPatch; inverse: FileSystemPatch } {
  const { changed: fields, previous } = diffSidebarItemFields(item, { ...item, ...after })
  return {
    forward: { type: 'updateSidebarItem', itemId: item._id, before: previous, fields },
    inverse: { type: 'updateSidebarItem', itemId: item._id, before: fields, fields: previous },
  }
}

function pushUpdate<T extends SidebarItemPatchRow>(
  patches: OptimisticPatchPair,
  item: T,
  after: Partial<T>,
) {
  const patch = updatePatch(item, after)
  patches.forwardPatches.push(patch.forward)
  patches.inversePatches.push(patch.inverse)
}

function pushRemove<T extends SidebarItemPatchRow>(patches: OptimisticPatchPair, item: T) {
  patches.forwardPatches.push({ type: 'removeSidebarItem', itemId: item._id, snapshot: item })
  patches.inversePatches.push({ type: 'upsertSidebarItem', item })
}

function treeItems<T extends SidebarItemPatchRow>(items: Array<T>, rootId: SidebarItemId) {
  const itemsById = new Map(items.map((item) => [item._id, item]))
  const root = itemsById.get(rootId)
  if (!root) return []
  if (root.type !== SIDEBAR_ITEM_TYPES.folders) return [root]
  return [
    root,
    ...Array.from(collectDescendantIdsFromItems(rootId, items))
      .map((id) => itemsById.get(id))
      .filter((item): item is T => Boolean(item)),
  ]
}

export function projectTrashRoots<T extends SidebarItemPatchRow>(
  items: Array<T>,
  rootIds: Array<SidebarItemId>,
  metadata: { now: number; userId: UserProfileId | null },
): OptimisticPatchPair {
  const patches = emptyPatchPair()
  for (const rootId of rootIds) {
    for (const item of treeItems(items, rootId)) {
      pushUpdate(patches, item, {
        parentId: item._id === rootId ? null : item.parentId,
        status: SIDEBAR_ITEM_STATUS.trashed,
        deletionTime: metadata.now,
        deletedBy: metadata.userId,
      } as Partial<T>)
    }
  }
  return patches
}

function projectRestoreRoots<T extends SidebarItemPatchRow>(
  items: Array<T>,
  rootIds: Array<SidebarItemId>,
  targetParentId: SidebarItemId | null,
): OptimisticPatchPair {
  const patches = emptyPatchPair()
  for (const rootId of rootIds) {
    for (const item of treeItems(items, rootId)) {
      pushUpdate(patches, item, {
        parentId: item._id === rootId ? targetParentId : item.parentId,
        status: SIDEBAR_ITEM_STATUS.active,
        deletionTime: null,
        deletedBy: null,
      } as Partial<T>)
    }
  }
  return patches
}

export function projectDeleteForeverRoots<T extends SidebarItemPatchRow>(
  items: Array<T>,
  rootIds: Array<SidebarItemId>,
): OptimisticPatchPair {
  const patches = emptyPatchPair()
  for (const rootId of rootIds) {
    for (const item of treeItems(items, rootId)) {
      pushRemove(patches, item)
    }
  }
  return patches
}

function appendPatchPair(target: OptimisticPatchPair, source: OptimisticPatchPair) {
  target.forwardPatches.push(...source.forwardPatches)
  target.inversePatches.push(...source.inversePatches)
}

function projectReplacementDestination<T extends SidebarItemPatchRow>({
  patches,
  activeItems,
  operation,
  now,
}: {
  patches: OptimisticPatchPair
  activeItems: Array<T>
  operation: TransferOperation
  now: number
}) {
  if (operation.action !== 'replace' || !operation.destinationItemId) return
  appendPatchPair(
    patches,
    projectTrashRoots(activeItems, [operation.destinationItemId], { now, userId: null }),
  )
}

function projectMergeFolderOperation<T extends SidebarItemPatchRow>({
  patches,
  activeItems,
  activeItemsById,
  operation,
  now,
}: {
  patches: OptimisticPatchPair
  activeItems: Array<T>
  activeItemsById: ReadonlyMap<SidebarItemId, T>
  operation: Extract<TransferOperation, { action: 'mergeFolder' }>
  now: number
}) {
  const source = activeItemsById.get(operation.sourceItemId)
  if (!source || activeItems.some((item) => item.parentId === source._id)) return
  appendPatchPair(patches, projectTrashRoots(activeItems, [source._id], { now, userId: null }))
}

function projectMoveOrRestoreOperation<T extends SidebarItemPatchRow>({
  patches,
  activeItemsById,
  trashItems,
  trashItemsById,
  operation,
}: {
  patches: OptimisticPatchPair
  activeItemsById: ReadonlyMap<SidebarItemId, T>
  trashItems: Array<T>
  trashItemsById: ReadonlyMap<SidebarItemId, T>
  operation: Extract<TransferOperation, { action: 'place' | 'replace' }>
}) {
  const source = activeItemsById.get(operation.sourceItemId)
  if (source) {
    pushUpdate(patches, source, {
      parentId: operation.targetParentId,
      ...(operation.name ? { name: operation.name } : {}),
    } as Partial<T>)
    return
  }

  if (!trashItemsById.has(operation.sourceItemId)) return
  appendPatchPair(
    patches,
    projectRestoreRoots(trashItems, [operation.sourceItemId], operation.targetParentId),
  )
}

export function projectMoveOperations<T extends SidebarItemPatchRow>({
  activeItems,
  trashItems,
  operations,
  now,
}: {
  activeItems: Array<T>
  trashItems: Array<T>
  operations: Array<TransferOperation>
  now: number
}): OptimisticPatchPair {
  const activeItemsById = new Map(activeItems.map((item) => [item._id, item]))
  const trashItemsById = new Map(trashItems.map((item) => [item._id, item]))
  const patches = emptyPatchPair()

  for (const operation of operations) {
    projectReplacementDestination({ patches, activeItems, operation, now })

    if (operation.action === 'mergeFolder') {
      projectMergeFolderOperation({ patches, activeItems, activeItemsById, operation, now })
      continue
    }

    projectMoveOrRestoreOperation({
      patches,
      activeItemsById,
      trashItems,
      trashItemsById,
      operation,
    })
  }

  return patches
}

export function applyFileSystemPatchesToSnapshot<T extends { _id: SidebarItemId }>(
  snapshot: FileSystemPatchSnapshot<T>,
  patches: Array<FileSystemPatch>,
): FileSystemPatchSnapshot<T | PatchProjectionItem> {
  const itemsById = new Map<SidebarItemId, T | PatchProjectionItem>(
    snapshot.items.map((item) => [item._id, item]),
  )
  const order = snapshot.items.map((item) => item._id)
  const orderIds = new Set(order)
  const removedIds = new Set<SidebarItemId>()

  for (const patch of patches) {
    if (patch.type === 'removeSidebarItem') {
      itemsById.delete(patch.itemId)
      removedIds.add(patch.itemId)
      continue
    }

    if (patch.type === 'upsertSidebarItem') {
      itemsById.set(patch.item._id, patch.item)
      removedIds.delete(patch.item._id)
      if (!orderIds.has(patch.item._id)) {
        order.push(patch.item._id)
        orderIds.add(patch.item._id)
      }
      continue
    }

    if (patch.type !== 'updateSidebarItem') continue

    const existing = itemsById.get(patch.itemId)
    if (!existing) {
      throw new Error(`Cannot apply filesystem patch for missing sidebar item ${patch.itemId}`)
    }
    itemsById.set(patch.itemId, { ...existing, ...patch.fields })
    removedIds.delete(patch.itemId)
  }

  return {
    items: order
      .filter((itemId) => !removedIds.has(itemId))
      .map((itemId) => itemsById.get(itemId))
      .filter((item): item is T | PatchProjectionItem => Boolean(item)),
  }
}
