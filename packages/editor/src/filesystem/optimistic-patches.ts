import type { ResourceId, CampaignMemberId } from '../resources/domain-id'
import {
  RESOURCE_LOCATION,
  RESOURCE_STATUS,
  RESOURCE_TYPES,
} from '../workspace/items-persistence-contract'
import type { AnyItem } from '../workspace/items'
import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import { diffResourceFields } from './patch-contract'
import type { ResourceCreateCommand, ResourceRenameCommand } from './transaction-contract'
import type { ResourcePatch } from './patch-contract'
import type { FileSystemOptimisticPreview } from './domain/lifecycle'
import { sidebarCachePatchItemFromCacheItem } from './cache-patches'
import type { SidebarCacheSnapshot } from './cache-patches'

export function buildOptimisticCreatePreview({
  command,
  parentId,
  currentActorId,
  workspaceId,
  name,
  now = Date.now(),
}: {
  command: ResourceCreateCommand
  parentId: ResourceId | null
  currentActorId: CampaignMemberId | null
  workspaceId: string
  name: AnyItem['name']
  now?: number
}): FileSystemOptimisticPreview {
  if (!currentActorId) {
    return {
      receiptPatches: [],
      inversePatches: [],
      optimisticIntents: [],
      rollbackIntents: [],
    }
  }

  const item = buildOptimisticCreateItem({
    workspaceId,
    command,
    currentActorId,
    id: command.resourceId,
    name,
    now,
    parentId,
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
  currentActorId,
  id,
  name,
  now,
  parentId,
}: {
  workspaceId: string
  command: ResourceCreateCommand
  currentActorId: CampaignMemberId
  id: ResourceId
  name: AnyItem['name']
  now: number
  parentId: ResourceId | null
}): AnyItem {
  const base = {
    id,
    createdAt: now,
    name,
    campaignId: workspaceId as AnyItem['campaignId'],
    parentId,
    allPermissionLevel: null,
    location: RESOURCE_LOCATION.sidebar,
    status: RESOURCE_STATUS.active,
    previewAssetId: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: currentActorId,
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
