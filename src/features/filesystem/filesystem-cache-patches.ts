import { SIDEBAR_ITEM_STATUS } from 'convex/sidebarItems/types/baseTypes'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import {
  applyFileSystemPatchesToSnapshot as applyPatchesToItemSnapshot,
  invertFileSystemPatches,
} from 'convex/sidebarItems/filesystem/patchProjection'
import type { AnySidebarItem, AnySidebarItemRow } from 'convex/sidebarItems/types/types'

export type SidebarCacheSnapshot = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
}

type CacheableSidebarItem = AnySidebarItemRow &
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
    isActive: item.status === SIDEBAR_ITEM_STATUS.active,
    isTrashed: item.status === SIDEBAR_ITEM_STATUS.trashed,
  } as AnySidebarItem
}

type IndexedSidebarSnapshot = {
  sidebarOrder: Array<Id<'sidebarItems'>>
  trashOrder: Array<Id<'sidebarItems'>>
}

function buildIndexedSnapshot(snapshot: SidebarCacheSnapshot): IndexedSidebarSnapshot {
  return {
    sidebarOrder: snapshot.sidebar.map((item) => item._id),
    trashOrder: snapshot.trash.map((item) => item._id),
  }
}

function materializeCacheSnapshot(
  order: IndexedSidebarSnapshot,
  items: Array<AnySidebarItem>,
): SidebarCacheSnapshot {
  const itemsById = new Map(items.map((item) => [item._id, item]))
  const sidebar: Array<AnySidebarItem> = []
  const trash: Array<AnySidebarItem> = []
  const seen = new Set<Id<'sidebarItems'>>()
  const sidebarOrder = [...order.sidebarOrder, ...items.map((item) => item._id)]
  const trashOrder = [...order.trashOrder, ...items.map((item) => item._id)]

  for (const itemId of sidebarOrder) {
    if (seen.has(itemId)) continue
    const item = itemsById.get(itemId)
    if (!item) continue
    if (itemStatus(item as CacheableSidebarItem) !== SIDEBAR_ITEM_STATUS.active) continue
    sidebar.push(item)
    seen.add(itemId)
  }
  for (const itemId of trashOrder) {
    if (seen.has(itemId)) continue
    const item = itemsById.get(itemId)
    if (!item) continue
    if (itemStatus(item as CacheableSidebarItem) !== SIDEBAR_ITEM_STATUS.trashed) continue
    trash.push(item)
    seen.add(itemId)
  }

  return { sidebar, trash }
}

function patchIsAlreadyReconciledByVisibleQueries(
  patch: FileSystemPatch,
  snapshot: SidebarCacheSnapshot,
) {
  if (patch.type !== 'updateSidebarItem') return false
  if (patch.fields.status !== SIDEBAR_ITEM_STATUS.undoHidden) return false

  return (
    !snapshot.sidebar.some((item) => item._id === patch.itemId) &&
    !snapshot.trash.some((item) => item._id === patch.itemId)
  )
}

export function applyFileSystemPatchesToSnapshot(
  snapshot: SidebarCacheSnapshot,
  patches: Array<FileSystemPatch>,
): SidebarCacheSnapshot {
  const order = buildIndexedSnapshot(snapshot)
  const applicablePatches = patches.filter(
    (patch) => !patchIsAlreadyReconciledByVisibleQueries(patch, snapshot),
  )
  const { items } = applyPatchesToItemSnapshot(
    { items: [...snapshot.sidebar, ...snapshot.trash] },
    applicablePatches,
  )
  return materializeCacheSnapshot(order, items.map(enhancePatchRowForSidebarCache))
}

export { invertFileSystemPatches }
