import { SIDEBAR_ITEM_STATUS } from 'shared/sidebar-items/types'
import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { Id } from 'convex/_generated/dataModel'
import type { FileSystemPatch } from 'convex/sidebarItems/filesystem/receipts'
import { applyFileSystemPatchesToSnapshot as applyPatchesToItemSnapshot } from 'convex/sidebarItems/filesystem/patchProjection'
import type { AnySidebarItem, AnySidebarItemRow } from 'convex/sidebarItems/types/types'
import { isOptimisticSidebarItemId } from './optimistic-sidebar-items'

export type SidebarCacheSnapshot = {
  sidebar: Array<AnySidebarItem>
  trash: Array<AnySidebarItem>
}

type CacheableSidebarItem = AnySidebarItemRow &
  Partial<Pick<AnySidebarItem, 'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'>>

type SidebarCacheFields = Pick<
  AnySidebarItem,
  'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'
>

function itemStatus(item: CacheableSidebarItem) {
  if (item.status === SIDEBAR_ITEM_STATUS.trashed) return SIDEBAR_ITEM_STATUS.trashed
  if (item.status === SIDEBAR_ITEM_STATUS.undoHidden) return SIDEBAR_ITEM_STATUS.undoHidden
  return SIDEBAR_ITEM_STATUS.active
}

function hasSidebarCacheFields(
  item: CacheableSidebarItem,
): item is CacheableSidebarItem & SidebarCacheFields {
  return (
    Array.isArray(item.shares) &&
    typeof item.isBookmarked === 'boolean' &&
    item.myPermissionLevel !== undefined &&
    'previewUrl' in item
  )
}

function enhancePatchRowForSidebarCache(
  item: CacheableSidebarItem,
  existing?: AnySidebarItem,
): AnySidebarItem {
  const cacheFields = hasSidebarCacheFields(item) ? item : existing
  return {
    ...item,
    shares: cacheFields?.shares ?? [],
    isBookmarked: cacheFields?.isBookmarked ?? false,
    myPermissionLevel: cacheFields?.myPermissionLevel ?? PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: cacheFields?.previewUrl ?? null,
    isActive: item.status === SIDEBAR_ITEM_STATUS.active,
    isTrashed: item.status === SIDEBAR_ITEM_STATUS.trashed,
  } as AnySidebarItem
}

function materializeView({
  originalOrder,
  patchedOrder,
  itemsById,
  status,
}: {
  originalOrder: Array<Id<'sidebarItems'>>
  patchedOrder: Array<Id<'sidebarItems'>>
  itemsById: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  status: typeof SIDEBAR_ITEM_STATUS.active | typeof SIDEBAR_ITEM_STATUS.trashed
}): Array<AnySidebarItem> {
  const seen = new Set<Id<'sidebarItems'>>()
  const result: Array<AnySidebarItem> = []
  for (const itemId of [...originalOrder, ...patchedOrder]) {
    if (seen.has(itemId)) continue
    const item = itemsById.get(itemId)
    if (!item || itemStatus(item as CacheableSidebarItem) !== status) continue
    seen.add(itemId)
    result.push(item)
  }
  return result
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

function patchCanApplyToSidebarCache(
  patch: FileSystemPatch,
  visibleItemIds: ReadonlySet<Id<'sidebarItems'>>,
) {
  if (patch.type !== 'upsertSidebarItem') return true
  if (visibleItemIds.has(patch.item._id)) return true
  if (isOptimisticSidebarItemId(patch.item._id)) return true
  return hasSidebarCacheFields(patch.item)
}

export function applyFileSystemPatchesToSnapshot(
  snapshot: SidebarCacheSnapshot,
  patches: Array<FileSystemPatch>,
): SidebarCacheSnapshot {
  const originalItemsById = new Map(
    [...snapshot.sidebar, ...snapshot.trash].map((item) => [item._id, item]),
  )
  const visibleItemIds = new Set(originalItemsById.keys())
  const applicablePatches = patches.filter((patch) => {
    if (patchIsAlreadyReconciledByVisibleQueries(patch, snapshot)) return false
    return patchCanApplyToSidebarCache(patch, visibleItemIds)
  })
  const { items } = applyPatchesToItemSnapshot(
    { items: [...snapshot.sidebar, ...snapshot.trash] },
    applicablePatches,
  )
  const patchedItems = items.map((item) =>
    enhancePatchRowForSidebarCache(item, originalItemsById.get(item._id)),
  )
  const itemsById = new Map(patchedItems.map((item) => [item._id, item]))
  const patchedOrder = patchedItems.map((item) => item._id)
  return {
    sidebar: materializeView({
      originalOrder: snapshot.sidebar.map((item) => item._id),
      patchedOrder,
      itemsById,
      status: SIDEBAR_ITEM_STATUS.active,
    }),
    trash: materializeView({
      originalOrder: snapshot.trash.map((item) => item._id),
      patchedOrder,
      itemsById,
      status: SIDEBAR_ITEM_STATUS.trashed,
    }),
  }
}
