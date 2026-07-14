import type { ResourceId } from '../resources/domain-id'
import type { AnyItem } from '../workspace/items'
import type { ResourcePatch } from './patch-contract'

type SidebarSharePatch = Extract<ResourcePatch, { type: 'upsertResourceShare' }>['share']

function sidebarSharePatchToCacheShare(share: SidebarSharePatch): AnyItem['shares'][number] {
  const { memberId, resourceId, workspaceId, ...shareFields } = share
  return {
    ...shareFields,
    campaignId: workspaceId,
    campaignMemberId: memberId,
    sidebarItemId: resourceId,
  }
}

function updateCachedItem(
  itemsById: Map<ResourceId, AnyItem>,
  itemId: ResourceId,
  update: (item: AnyItem) => AnyItem,
) {
  const item = itemsById.get(itemId)
  if (!item) return
  itemsById.set(itemId, update(item))
}

export function applySharePatchState(
  items: Array<AnyItem>,
  patches: Array<ResourcePatch>,
): Array<AnyItem> {
  const itemsById = new Map(items.map((item) => [item.id, item]))

  for (const patch of patches) {
    if (patch.type === 'upsertResourceShare') {
      updateCachedItem(itemsById, patch.share.resourceId, (item) => ({
        ...item,
        shares: [
          ...item.shares.filter((share) => share.id !== patch.share.id),
          sidebarSharePatchToCacheShare(patch.share),
        ],
      }))
      continue
    }

    if (patch.type === 'updateResourceShare') {
      updateCachedItem(itemsById, patch.resourceId, (item) => ({
        ...item,
        shares: item.shares.map((share) =>
          share.campaignMemberId === patch.memberId ? { ...share, ...patch.fields } : share,
        ),
      }))
      continue
    }

    if (patch.type === 'removeResourceShare') {
      updateCachedItem(itemsById, patch.share.resourceId, (item) => ({
        ...item,
        shares: item.shares.filter((share) => share.id !== patch.share.id),
      }))
      continue
    }

    if (patch.type === 'updateFolderShare') {
      updateCachedItem(itemsById, patch.folderId, (item) =>
        'inheritShares' in item && patch.fields.inheritShares !== undefined
          ? { ...item, inheritShares: patch.fields.inheritShares }
          : item,
      )
    }
  }

  return items.map((item) => itemsById.get(item.id) ?? item)
}
