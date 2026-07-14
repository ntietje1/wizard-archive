import type { ResourceId } from '../resources/domain-id'
import { assertResourceItemSlug, RESOURCE_SLUG_MAX_LENGTH } from '../workspace/items'
import { OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX } from '../workspace/items/optimistic'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import type { ResourceSlug } from '../workspace/resource-contract'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { diffResourceFields } from './patch-contract'
import type { ResourceCreateCommand, ResourceRenameCommand } from './transaction-contract'
import type { ResourcePatch } from './patch-contract'
import { deduplicateSlug, slugify } from '../../../../shared/slugs'
import type { UserProfileId } from '../../../../shared/common/ids'
import type { FileSystemOptimisticPreview } from './domain/lifecycle'
import { sidebarCachePatchItemFromCacheItem } from './cache-patches'
import type { SidebarCacheSnapshot } from './cache-patches'

let optimisticIdIndex = 0

function nextOptimisticIdIndex() {
  optimisticIdIndex += 1
  return optimisticIdIndex
}

export function expectedOptimisticCreateSlug(
  name: string,
  existingSlugs: ReadonlySet<string>,
): ResourceSlug {
  const normalized = slugify(name, {
    fallback: 'item',
    maxLength: RESOURCE_SLUG_MAX_LENGTH,
  })
  return assertResourceItemSlug(
    deduplicateSlug(normalized, existingSlugs, {
      label: 'Slug',
      maxLength: RESOURCE_SLUG_MAX_LENGTH,
    }),
  )
}

export function buildOptimisticCreatePreview({
  command,
  parentId,
  currentUserId,
  workspaceId,
  name,
  slug,
  now = Date.now(),
}: {
  command: ResourceCreateCommand
  parentId: ResourceId | null
  currentUserId: UserProfileId | null
  workspaceId: string
  name: AnyItem['name']
  slug: ResourceSlug
  now?: number
}): FileSystemOptimisticPreview {
  if (!currentUserId) {
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const index = nextOptimisticIdIndex()
  const item = buildOptimisticCreateItem({
    workspaceId,
    command,
    currentUserId,
    id: `${OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX}create-${now}-${index}` as ResourceId,
    name,
    now,
    parentId,
    slug,
  })

  const patchRow = sidebarCachePatchItemFromCacheItem(item)
  const receiptPatches: Array<ResourcePatch> = [{ type: 'upsertResource', item: patchRow }]
  return {
    receiptPatches,
    inversePatches: [{ type: 'removeResource', itemId: item.id, snapshot: patchRow }],
    optimisticIntents: parentId
      ? [{ type: 'openFolder' as const, workspaceId, folderId: parentId }]
      : [],
    rollbackIntents: [],
  }
}

function buildOptimisticCreateItem({
  workspaceId,
  command,
  currentUserId,
  id,
  name,
  now,
  parentId,
  slug,
}: {
  workspaceId: string
  command: ResourceCreateCommand
  currentUserId: UserProfileId
  id: ResourceId
  name: AnyItem['name']
  now: number
  parentId: ResourceId | null
  slug: ResourceSlug
}): AnyItem {
  const base = {
    id,
    createdAt: now,
    name,
    slug,
    campaignId: workspaceId as AnyItem['campaignId'],
    parentId,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: currentUserId,
    deletionTime: null,
    deletedBy: null,
    isActive: true,
    isTrashed: false,
    iconName: command.iconName ?? null,
    color: command.color ?? null,
    shares: [],
    isBookmarked: false,
    myPermissionLevel: PERMISSION_LEVEL.FULL_ACCESS,
    previewUrl: null,
  }

  switch (command.itemType) {
    case RESOURCE_TYPES.folders:
      return { ...base, type: RESOURCE_TYPES.folders, inheritShares: true }
    case RESOURCE_TYPES.files:
      return {
        ...base,
        type: RESOURCE_TYPES.files,
        assetId: null,
        downloadUrl: null,
        contentType: null,
      }
    case RESOURCE_TYPES.gameMaps:
      return { ...base, type: RESOURCE_TYPES.gameMaps, imageAssetId: null, imageUrl: null }
    case RESOURCE_TYPES.notes:
      return { ...base, type: RESOURCE_TYPES.notes }
    case RESOURCE_TYPES.canvases:
      return { ...base, type: RESOURCE_TYPES.canvases }
  }
}

export function buildOptimisticRenamePreview(
  snapshot: SidebarCacheSnapshot,
  command: ResourceRenameCommand,
): FileSystemOptimisticPreview {
  const item =
    snapshot.sidebar.find((candidate) => candidate.id === command.itemId) ??
    snapshot.trash.find((candidate) => candidate.id === command.itemId)
  if (!item) {
    // The item may have been removed by a concurrent update before the optimistic rename applies.
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const { changed: fields, previous } = diffResourceFields(item, {
    ...item,
    ...(command.name !== undefined ? { name: command.name as AnyItem['name'] } : {}),
    ...(command.iconName !== undefined ? { iconName: command.iconName } : {}),
    ...(command.color !== undefined ? { color: command.color } : {}),
  } as AnyItem)

  if (Object.keys(fields).length === 0) {
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const receiptPatches: Array<ResourcePatch> = [
    { type: 'updateResource', itemId: item.id, before: previous, fields },
  ]
  return {
    receiptPatches,
    inversePatches: [{ type: 'updateResource', itemId: item.id, before: fields, fields: previous }],
    optimisticIntents: [],
    rollbackIntents: [],
  }
}
