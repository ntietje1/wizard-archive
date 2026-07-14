import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import {
  assertResourceColor,
  assertResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import type {
  AnyResourceRow,
  ResourceShare,
} from '@wizard-archive/editor/resources/resource-contract'
import { assertConvexResourceTitle } from '../validation/name'
import { assertConvexSidebarItemSlug } from '../validation/slug'
import { isActiveSidebarItem, isTrashedSidebarItem } from '../types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { PermissionLevel } from '../../../shared/permissions/types'

type SidebarItemEnhancementRow = AnyResourceRow | (Doc<'sidebarItems'> & { previewAssetId?: never })

export type SidebarItemEnhancement = {
  shares: Array<ResourceShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
}

function storageIdFromAssetId(assetId: unknown): Id<'_storage'> {
  return assetId as Id<'_storage'>
}

function normalizeSidebarItemFields<T extends SidebarItemEnhancementRow>(item: T) {
  const normalizedId = 'id' in item ? item.id : item._id
  const normalizedCreatedAt = 'createdAt' in item ? item.createdAt : item._creationTime
  const {
    _id: _rawId,
    _creationTime: _rawCreationTime,
    normalizedName: _normalizedName,
    previewStorageId,
    previewUpdatedAt: _previewUpdatedAt,
    ...publicFields
  } = item as T & {
    _id?: Id<'sidebarItems'>
    _creationTime?: number
    normalizedName?: string
    previewStorageId?: Id<'_storage'> | null
    previewUpdatedAt?: number | null
  }
  const previewAssetId = item.previewAssetId ?? previewStorageId ?? null
  return {
    ...publicFields,
    id: normalizedId,
    createdAt: normalizedCreatedAt,
    name: assertConvexResourceTitle(item.name),
    iconName: item.iconName === null ? null : assertResourceIconName(item.iconName),
    color: item.color === null ? null : assertResourceColor(item.color),
    slug: assertConvexSidebarItemSlug(item.slug),
    previewAssetId,
  }
}

export async function enhanceBase<T extends SidebarItemEnhancementRow>(
  ctx: CampaignQueryCtx,
  { item, enhancement }: { item: T; enhancement?: SidebarItemEnhancement },
) {
  const { membership } = ctx
  const normalizedItem = normalizeSidebarItemFields(item)

  const [shares, isBookmarked, myPermissionLevel, previewUrl] = await Promise.all([
    enhancement
      ? enhancement.shares
      : membership.role === CAMPAIGN_MEMBER_ROLE.DM
        ? ctx.db
            .query('sidebarItemShares')
            .withIndex('by_campaign_item_member', (q) =>
              q.eq('campaignId', normalizedItem.campaignId).eq('sidebarItemId', normalizedItem.id),
            )
            .collect()
            .then((rows) => rows.map(toResourceShare))
        : [],
    enhancement
      ? enhancement.isBookmarked
      : ctx.db
          .query('bookmarks')
          .withIndex('by_campaign_member_item', (q) =>
            q
              .eq('campaignId', normalizedItem.campaignId)
              .eq('campaignMemberId', membership._id)
              .eq('sidebarItemId', normalizedItem.id),
          )
          .unique()
          .then((bookmark) => bookmark !== null),
    enhancement?.myPermissionLevel ?? getSidebarItemPermissionLevel(ctx, { item: normalizedItem }),
    normalizedItem.previewAssetId
      ? ctx.storage.getUrl(storageIdFromAssetId(normalizedItem.previewAssetId))
      : null,
  ])

  return {
    ...normalizedItem,
    shares,
    isBookmarked,
    myPermissionLevel,
    previewUrl,
    isActive: isActiveSidebarItem(normalizedItem),
    isTrashed: isTrashedSidebarItem(normalizedItem),
  }
}

export function toResourceShare(share: Doc<'sidebarItemShares'>): ResourceShare {
  const { _id: _rowId, _creationTime, resourceShareUuid, ...fields } = share
  return {
    ...fields,
    id: resourceShareUuid,
    createdAt: _creationTime,
  }
}
