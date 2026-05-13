import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export type SidebarCacheSnapshot = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
}

type CacheableSidebarItem = Omit<
  AnySidebarItem,
  'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'
> &
  Partial<Pick<AnySidebarItem, 'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'>>

function itemStatus(item: CacheableSidebarItem) {
  if (item.status === SIDEBAR_ITEM_STATUS.trashed) return SIDEBAR_ITEM_STATUS.trashed
  if (item.status === SIDEBAR_ITEM_STATUS.undoHidden) return SIDEBAR_ITEM_STATUS.undoHidden
  return SIDEBAR_ITEM_STATUS.active
}

function enhancePatchRowForSidebarCache(item: CacheableSidebarItem): AnySidebarItem {
  return {
    ...item,
    shares: item.shares ?? [],
    isBookmarked: item.isBookmarked ?? false,
    myPermissionLevel: item.myPermissionLevel ?? PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: item.previewUrl ?? null,
  } as AnySidebarItem
}

type IndexedSidebarSnapshot = {
  itemsById: Map<Id<'sidebarItems'>, AnySidebarItem>
  sidebarOrder: Array<Id<'sidebarItems'>>
  trashOrder: Array<Id<'sidebarItems'>>
  sidebarOrderIds: Set<Id<'sidebarItems'>>
  trashOrderIds: Set<Id<'sidebarItems'>>
  activeIds: Set<Id<'sidebarItems'>>
  trashIds: Set<Id<'sidebarItems'>>
  removedIds: Set<Id<'sidebarItems'>>
}

function buildIndexedSnapshot(snapshot: SidebarCacheSnapshot): IndexedSidebarSnapshot {
  const itemsById = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  const sidebarOrder: Array<Id<'sidebarItems'>> = []
  const trashOrder: Array<Id<'sidebarItems'>> = []
  const sidebarOrderIds = new Set<Id<'sidebarItems'>>()
  const trashOrderIds = new Set<Id<'sidebarItems'>>()
  const activeIds = new Set<Id<'sidebarItems'>>()
  const trashIds = new Set<Id<'sidebarItems'>>()

  for (const item of snapshot.sidebar) {
    itemsById.set(item._id, item)
    sidebarOrder.push(item._id)
    sidebarOrderIds.add(item._id)
    activeIds.add(item._id)
  }
  for (const item of snapshot.trash) {
    itemsById.set(item._id, item)
    trashOrder.push(item._id)
    trashOrderIds.add(item._id)
    trashIds.add(item._id)
  }

  return {
    itemsById,
    sidebarOrder,
    trashOrder,
    sidebarOrderIds,
    trashOrderIds,
    activeIds,
    trashIds,
    removedIds: new Set(),
  }
}

function appendIfNew(
  order: Array<Id<'sidebarItems'>>,
  orderIds: Set<Id<'sidebarItems'>>,
  itemId: Id<'sidebarItems'>,
) {
  if (orderIds.has(itemId)) return
  order.push(itemId)
  orderIds.add(itemId)
}

function removeIndexedItem(state: IndexedSidebarSnapshot, itemId: Id<'sidebarItems'>) {
  state.itemsById.delete(itemId)
  state.activeIds.delete(itemId)
  state.trashIds.delete(itemId)
  state.sidebarOrderIds.delete(itemId)
  state.trashOrderIds.delete(itemId)
  state.removedIds.add(itemId)
}

function placeIndexedItem(state: IndexedSidebarSnapshot, item: CacheableSidebarItem) {
  const normalized = {
    ...item,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
  }
  const status = itemStatus(normalized)
  const normalizedItem = enhancePatchRowForSidebarCache({ ...normalized, status })

  state.itemsById.set(item._id, normalizedItem)
  state.activeIds.delete(item._id)
  state.trashIds.delete(item._id)

  if (status === SIDEBAR_ITEM_STATUS.active) {
    appendIfNew(state.sidebarOrder, state.sidebarOrderIds, item._id)
    state.activeIds.add(item._id)
  }
  if (status === SIDEBAR_ITEM_STATUS.trashed) {
    appendIfNew(state.trashOrder, state.trashOrderIds, item._id)
    state.trashIds.add(item._id)
  }
}

function applyPatch(state: IndexedSidebarSnapshot, patch: FileSystemPatch) {
  if (patch.type === 'removeSidebarItem') {
    removeIndexedItem(state, patch.itemId)
    return
  }

  if (patch.type === 'upsertSidebarItem') {
    placeIndexedItem(state, patch.item as CacheableSidebarItem)
    return
  }

  const existing = state.itemsById.get(patch.itemId)
  if (!existing) {
    throw new Error(`Cannot apply filesystem patch for missing sidebar item ${patch.itemId}`)
  }
  placeIndexedItem(state, { ...existing, ...patch.fields } as CacheableSidebarItem)
}

function materializeIndexedSnapshot(state: IndexedSidebarSnapshot): SidebarCacheSnapshot {
  const sidebar = state.sidebarOrder
    .filter((itemId) => state.activeIds.has(itemId) && !state.removedIds.has(itemId))
    .map((itemId) => state.itemsById.get(itemId))
    .filter((item): item is AnySidebarItem => Boolean(item))
  const trash = state.trashOrder
    .filter((itemId) => state.trashIds.has(itemId) && !state.removedIds.has(itemId))
    .map((itemId) => state.itemsById.get(itemId))
    .filter((item): item is AnySidebarItem => Boolean(item))
  return { sidebar, trash }
}

export function applyFileSystemPatchesToSnapshot(
  snapshot: SidebarCacheSnapshot,
  patches: Array<FileSystemPatch>,
): SidebarCacheSnapshot {
  const state = buildIndexedSnapshot(snapshot)

  for (const patch of patches) {
    applyPatch(state, patch)
  }

  return materializeIndexedSnapshot(state)
}

export function invertFileSystemPatches(patches: Array<FileSystemPatch>): Array<FileSystemPatch> {
  return patches.map((patch): FileSystemPatch => {
    if (patch.type === 'upsertSidebarItem') {
      return {
        type: 'removeSidebarItem',
        itemId: patch.item._id,
        snapshot: patch.item,
      }
    }
    if (patch.type === 'removeSidebarItem') {
      if (!patch.snapshot) {
        throw new Error(`Cannot invert remove patch without a snapshot for ${patch.itemId}`)
      }
      return { type: 'upsertSidebarItem', item: patch.snapshot }
    }
    return {
      type: 'updateSidebarItem',
      itemId: patch.itemId,
      before: patch.fields,
      fields: patch.before,
    }
  })
}
