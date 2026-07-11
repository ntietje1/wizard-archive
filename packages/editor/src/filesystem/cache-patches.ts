import { RESOURCE_STATUS } from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import type { SidebarItemId } from '../../../../shared/common/ids'
import type { ResourcePatch, ResourcePatchRow } from './patch-contract'
import { applyFileSystemPatchesToSnapshot as applyPatchesToItemSnapshot } from './domain/patch-projection'
import { applyBookmarkPatchState } from './bookmark-cache-patches'
import { applySharePatchState } from './share-cache-patches'

export type SidebarCacheSnapshot = {
  sidebar: Array<AnyItem>
  trash: Array<AnyItem>
  hidden?: Array<AnyItem>
}

type CacheableSidebarItem = (ResourcePatchRow | AnyItem) &
  Partial<Pick<AnyItem, 'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'>>

type SidebarCacheFields = Pick<
  AnyItem,
  'shares' | 'isBookmarked' | 'myPermissionLevel' | 'previewUrl'
>

type SidebarCachePatchRowSource = Omit<ResourcePatchRow, 'workspaceId'> & {
  campaignId: AnyItem['campaignId']
}

type SidebarCachePatchItem = ResourcePatchRow & AnyItem

export function resourcePatchRowFromCacheItem(
  item: SidebarCachePatchRowSource | AnyItem,
): ResourcePatchRow {
  const {
    allPermissionLevel,
    campaignId,
    color,
    createdAt,
    createdBy,
    deletedBy,
    deletionTime,
    iconName,
    id,
    location,
    name,
    parentId,
    previewAssetId,
    slug,
    status,
    type,
    updatedBy,
    updatedTime,
  } = item
  return {
    allPermissionLevel,
    color,
    createdAt,
    createdBy,
    deletedBy,
    deletionTime,
    iconName,
    id,
    location,
    name,
    parentId,
    previewAssetId,
    slug,
    status,
    type,
    updatedBy,
    updatedTime,
    workspaceId: campaignId,
  }
}

export function sidebarCachePatchItemFromCacheItem(item: AnyItem): SidebarCachePatchItem {
  const row = resourcePatchRowFromCacheItem(item)
  const base = {
    ...row,
    campaignId: row.workspaceId as AnyItem['campaignId'],
    shares: item.shares,
    isBookmarked: item.isBookmarked,
    myPermissionLevel: item.myPermissionLevel,
    previewUrl: item.previewUrl,
    isActive: item.isActive,
    isTrashed: item.isTrashed,
  }

  switch (item.type) {
    case 'folder':
      return {
        ...base,
        type: item.type,
        inheritShares: item.inheritShares,
      } as SidebarCachePatchItem
    case 'file':
      return {
        ...base,
        type: item.type,
        assetId: item.assetId,
        downloadUrl: item.downloadUrl,
        contentType: item.contentType,
      } as SidebarCachePatchItem
    case 'gameMap':
      return {
        ...base,
        type: item.type,
        imageAssetId: item.imageAssetId,
        imageUrl: item.imageUrl,
      } as SidebarCachePatchItem
    case 'note':
    case 'canvas':
      return { ...base, type: item.type } as SidebarCachePatchItem
  }
}

function itemStatus(item: CacheableSidebarItem) {
  if (item.status === RESOURCE_STATUS.trashed) return RESOURCE_STATUS.trashed
  if (item.status === RESOURCE_STATUS.undoHidden) return RESOURCE_STATUS.undoHidden
  return RESOURCE_STATUS.active
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

function enhancePatchRowForSidebarCache(item: CacheableSidebarItem, existing?: AnyItem): AnyItem {
  const sidebarItemFields =
    'workspaceId' in item
      ? (() => {
          const { workspaceId, ...fields } = item
          return { ...fields, campaignId: workspaceId as AnyItem['campaignId'] }
        })()
      : item
  const cacheFields = hasSidebarCacheFields(item) ? item : existing
  if (!cacheFields) {
    throw new Error('Sidebar cache patch is missing required cache fields')
  }

  return {
    ...sidebarItemFields,
    shares: cacheFields.shares,
    isBookmarked: cacheFields.isBookmarked,
    myPermissionLevel: cacheFields.myPermissionLevel,
    previewUrl: cacheFields.previewUrl,
    isActive: item.status === RESOURCE_STATUS.active,
    isTrashed: item.status === RESOURCE_STATUS.trashed,
  } as AnyItem
}

function materializeView({
  originalOrder,
  patchedOrder,
  itemsById,
  status,
}: {
  originalOrder: Array<SidebarItemId>
  patchedOrder: Array<SidebarItemId>
  itemsById: ReadonlyMap<SidebarItemId, AnyItem>
  status: typeof RESOURCE_STATUS.active | typeof RESOURCE_STATUS.trashed
}): Array<AnyItem> {
  const seen = new Set<SidebarItemId>()
  const result: Array<AnyItem> = []
  for (const itemId of [...originalOrder, ...patchedOrder]) {
    if (seen.has(itemId)) continue
    const item = itemsById.get(itemId)
    if (!item || itemStatus(item) !== status) continue
    seen.add(itemId)
    result.push(item)
  }
  return result
}

function materializeHiddenView({
  patchedOrder,
  itemsById,
}: {
  patchedOrder: Array<SidebarItemId>
  itemsById: ReadonlyMap<SidebarItemId, AnyItem>
}): Array<AnyItem> {
  const result: Array<AnyItem> = []
  for (const itemId of patchedOrder) {
    const item = itemsById.get(itemId)
    if (item && itemStatus(item) === RESOURCE_STATUS.undoHidden) result.push(item)
  }
  return result
}

function patchIsAlreadyReconciledByVisibleQueries(
  patch: ResourcePatch,
  snapshot: SidebarCacheSnapshot,
) {
  if (patch.type !== 'updateResource') return false
  if (patch.fields.status !== RESOURCE_STATUS.undoHidden) return false

  return (
    !snapshot.sidebar.some((item) => item.id === patch.itemId) &&
    !snapshot.trash.some((item) => item.id === patch.itemId)
  )
}

function patchCanApplyToSidebarCache(
  patch: ResourcePatch,
  cacheItemIds: ReadonlySet<SidebarItemId>,
) {
  if (patch.type === 'upsertResource') {
    if (cacheItemIds.has(patch.item.id)) return true
    return hasSidebarCacheFields(patch.item)
  }

  if (patch.type === 'updateResource') {
    return cacheItemIds.has(patch.itemId)
  }

  return true
}

export function applyFileSystemPatchesToSidebarCache(
  snapshot: SidebarCacheSnapshot,
  patches: Array<ResourcePatch>,
): SidebarCacheSnapshot {
  const hidden = snapshot.hidden ?? []
  const originalItemsById = new Map(
    [...snapshot.sidebar, ...snapshot.trash, ...hidden].map((item) => [item.id, item]),
  )
  const cacheItemIds = new Set(originalItemsById.keys())
  const applicablePatches: Array<ResourcePatch> = []
  for (const patch of patches) {
    if (patchIsAlreadyReconciledByVisibleQueries(patch, snapshot)) continue
    if (!patchCanApplyToSidebarCache(patch, cacheItemIds)) continue
    applicablePatches.push(patch)
    if (patch.type === 'upsertResource') cacheItemIds.add(patch.item.id)
  }
  const { items } = applyPatchesToItemSnapshot(
    { items: [...snapshot.sidebar, ...snapshot.trash, ...hidden] },
    applicablePatches,
  )
  const patchedItems = applySharePatchState(
    applyBookmarkPatchState(
      items.map((item) => enhancePatchRowForSidebarCache(item, originalItemsById.get(item.id))),
      patches,
    ),
    patches,
  )
  const itemsById = new Map(patchedItems.map((item) => [item.id, item]))
  const patchedOrder = patchedItems.map((item) => item.id)
  const nextHidden = materializeHiddenView({ patchedOrder, itemsById })
  return {
    sidebar: materializeView({
      originalOrder: snapshot.sidebar.map((item) => item.id),
      patchedOrder,
      itemsById,
      status: RESOURCE_STATUS.active,
    }),
    trash: materializeView({
      originalOrder: snapshot.trash.map((item) => item.id),
      patchedOrder,
      itemsById,
      status: RESOURCE_STATUS.trashed,
    }),
    ...(nextHidden.length > 0 ? { hidden: nextHidden } : {}),
  }
}
