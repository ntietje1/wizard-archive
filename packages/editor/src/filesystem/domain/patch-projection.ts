import type { ResourceId, CampaignMemberId } from '../../resources/domain-id'
import { RESOURCE_STATUS, RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import { diffResourceFields, hasMismatchedPrecondition } from '../patch-contract'
import type { ResourcePatch, ResourcePatchRow } from '../patch-contract'
import type { TransferOperation } from '../operation-contract'
import { collectDescendantIdsFromItems } from './tree'

type PatchProjectionItem = Extract<ResourcePatch, { type: 'upsertResource' }>['item']

type FileSystemPatchSnapshot<T> = {
  items: Array<T>
}

type OptimisticPatchPair = {
  forwardPatches: Array<ResourcePatch>
  inversePatches: Array<ResourcePatch>
}

function emptyPatchPair(): OptimisticPatchPair {
  return { forwardPatches: [], inversePatches: [] }
}

function updatePatch<T extends ResourcePatchRow>(
  item: T,
  after: Partial<T>,
): { forward: ResourcePatch; inverse: ResourcePatch } {
  const { changed: fields, previous } = diffResourceFields(item, { ...item, ...after })
  return {
    forward: { type: 'updateResource', itemId: item.id, before: previous, fields },
    inverse: { type: 'updateResource', itemId: item.id, before: fields, fields: previous },
  }
}

function pushUpdate<T extends ResourcePatchRow>(
  patches: OptimisticPatchPair,
  item: T,
  after: Partial<T>,
) {
  const patch = updatePatch(item, after)
  patches.forwardPatches.push(patch.forward)
  patches.inversePatches.push(patch.inverse)
}

function pushRemove<T extends ResourcePatchRow>(patches: OptimisticPatchPair, item: T) {
  patches.forwardPatches.push({ type: 'removeResource', itemId: item.id, snapshot: item })
  patches.inversePatches.push({ type: 'upsertResource', item })
}

function treeItems<T extends ResourcePatchRow>(items: Array<T>, rootId: ResourceId) {
  const itemsById = new Map(items.map((item) => [item.id, item]))
  const root = itemsById.get(rootId)
  if (!root) return []
  if (root.type !== RESOURCE_TYPES.folders) return [root]
  return [
    root,
    ...Array.from(collectDescendantIdsFromItems(rootId, items))
      .map((id) => itemsById.get(id))
      .filter((item): item is T => Boolean(item)),
  ]
}

export function projectTrashRoots<T extends ResourcePatchRow>(
  items: Array<T>,
  rootIds: Array<ResourceId>,
  metadata: { now: number; userId: CampaignMemberId | null },
): OptimisticPatchPair {
  const patches = emptyPatchPair()
  for (const rootId of rootIds) {
    for (const item of treeItems(items, rootId)) {
      pushUpdate(patches, item, {
        parentId: item.id === rootId ? null : item.parentId,
        status: RESOURCE_STATUS.trashed,
        deletionTime: metadata.now,
        deletedBy: metadata.userId,
      } as Partial<T>)
    }
  }
  return patches
}

function projectRestoreRoots<T extends ResourcePatchRow>(
  items: Array<T>,
  rootIds: Array<ResourceId>,
  targetParentId: ResourceId | null,
  rootFields: Partial<T> = {},
): OptimisticPatchPair {
  const patches = emptyPatchPair()
  for (const rootId of rootIds) {
    for (const item of treeItems(items, rootId)) {
      const isRoot = item.id === rootId
      pushUpdate(patches, item, {
        ...(isRoot ? rootFields : {}),
        parentId: isRoot ? targetParentId : item.parentId,
        status: RESOURCE_STATUS.active,
        deletionTime: null,
        deletedBy: null,
      } as Partial<T>)
    }
  }
  return patches
}

export function projectDeleteForeverRoots<T extends ResourcePatchRow>(
  items: Array<T>,
  rootIds: Array<ResourceId>,
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

function projectMoveOrRestoreOperation<T extends ResourcePatchRow>({
  patches,
  activeItemsById,
  trashItems,
  trashItemsById,
  operation,
}: {
  patches: OptimisticPatchPair
  activeItemsById: ReadonlyMap<ResourceId, T>
  trashItems: Array<T>
  trashItemsById: ReadonlyMap<ResourceId, T>
  operation: TransferOperation
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
    projectRestoreRoots(
      trashItems,
      [operation.sourceItemId],
      operation.targetParentId,
      operation.name ? ({ name: operation.name } as Partial<T>) : {},
    ),
  )
}

function splitProjectedItems<T extends ResourcePatchRow>(
  items: Array<T>,
): {
  activeItems: Array<T>
  trashItems: Array<T>
} {
  return {
    activeItems: items.filter((item) => item.status === RESOURCE_STATUS.active),
    trashItems: items.filter((item) => item.status === RESOURCE_STATUS.trashed),
  }
}

export function projectMoveOperations<T extends ResourcePatchRow>({
  activeItems,
  trashItems,
  operations,
  now: _now,
  userId: _userId,
}: {
  activeItems: Array<T>
  trashItems: Array<T>
  operations: Array<TransferOperation>
  now: number
  userId: CampaignMemberId | null
}): OptimisticPatchPair {
  const patches = emptyPatchPair()
  let projectedItems = [...activeItems, ...trashItems]

  for (const operation of operations) {
    const patchStart = patches.forwardPatches.length
    const inversePatchStart = patches.inversePatches.length
    const current = splitProjectedItems(projectedItems)
    const activeItemsById = new Map(current.activeItems.map((item) => [item.id, item]))
    const trashItemsById = new Map(current.trashItems.map((item) => [item.id, item]))

    projectMoveOrRestoreOperation({
      patches,
      activeItemsById,
      trashItems: current.trashItems,
      trashItemsById,
      operation,
    })

    const operationInversePatches = patches.inversePatches.splice(inversePatchStart)
    patches.inversePatches.unshift(...operationInversePatches)

    if (patches.forwardPatches.length > patchStart) {
      projectedItems = applyFileSystemPatchesToSnapshot(
        { items: projectedItems },
        patches.forwardPatches.slice(patchStart),
      ).items as Array<T>
    }
  }

  return patches
}

export function applyFileSystemPatchesToSnapshot<T extends { id: ResourceId }>(
  snapshot: FileSystemPatchSnapshot<T>,
  patches: Array<ResourcePatch>,
): FileSystemPatchSnapshot<T | PatchProjectionItem> {
  const itemsById = new Map<ResourceId, T | PatchProjectionItem>(
    snapshot.items.map((item) => [item.id, item]),
  )
  const order = snapshot.items.map((item) => item.id)
  const orderIds = new Set(order)
  const removedIds = new Set<ResourceId>()

  for (const patch of patches) {
    if (patch.type === 'removeResource') {
      itemsById.delete(patch.itemId)
      removedIds.add(patch.itemId)
      continue
    }

    if (patch.type === 'upsertResource') {
      itemsById.set(patch.item.id, patch.item)
      removedIds.delete(patch.item.id)
      if (!orderIds.has(patch.item.id)) {
        order.push(patch.item.id)
        orderIds.add(patch.item.id)
      }
      continue
    }

    if (patch.type !== 'updateResource') continue

    const existing = itemsById.get(patch.itemId)
    if (!existing) {
      throw new Error(`Cannot apply filesystem patch for missing sidebar item ${patch.itemId}`)
    }
    if (
      hasMismatchedPrecondition(
        existing as Record<string, unknown>,
        patch.before as Record<string, unknown>,
      )
    ) {
      continue
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
