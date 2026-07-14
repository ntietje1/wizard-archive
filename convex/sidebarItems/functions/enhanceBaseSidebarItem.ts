import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import {
  assertResourceColor,
  assertResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import type {
  AnyResourceRow,
  ResourceShare,
} from '@wizard-archive/editor/resources/resource-contract'
import type { AssetId } from '@wizard-archive/editor/resources/domain-id'
import { assertConvexResourceTitle } from '../validation/name'
import { assertConvexSidebarItemSlug } from '../validation/slug'
import { getAssetIdByStorageId, getStorageIdByAssetId } from '../../storage/functions/assetIdentity'
import { isActiveSidebarItem, isTrashedSidebarItem } from '../types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import {
  loadSidebarItemShareIdentityProjection,
  projectSidebarItemShare,
} from '../../sidebarShares/functions/projectSidebarItemShare'

type SidebarItemEnhancementRow = AnyResourceRow | (Doc<'sidebarItems'> & { previewAssetId?: never })

export type SidebarItemEnhancement = {
  shares: Array<ResourceShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
}

function normalizeSidebarItemFields<T extends SidebarItemEnhancementRow>(
  item: T,
  previewAssetId: AssetId | null,
) {
  const normalizedId = 'id' in item ? item.id : item._id
  const normalizedCreatedAt = 'createdAt' in item ? item.createdAt : item._creationTime
  const {
    _id: _rawId,
    _creationTime: _rawCreationTime,
    normalizedName: _normalizedName,
    previewStorageId: _previewStorageId,
    previewUpdatedAt: _previewUpdatedAt,
    ...publicFields
  } = item as T & {
    _id?: Id<'sidebarItems'>
    _creationTime?: number
    normalizedName?: string
    previewStorageId?: Id<'_storage'> | null
    previewUpdatedAt?: number | null
  }
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
  const previewIdentity = await resolvePreviewIdentity(ctx, item)
  const normalizedItem = normalizeSidebarItemFields(item, previewIdentity.assetId)

  const [shares, isBookmarked, myPermissionLevel, previewUrl] = await Promise.all([
    enhancement
      ? enhancement.shares
      : membership.role === CAMPAIGN_MEMBER_ROLE.DM
        ? getResourceShares(ctx, normalizedItem.id)
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
    previewIdentity.storageId ? ctx.storage.getUrl(previewIdentity.storageId) : null,
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

async function getResourceShares(
  ctx: CampaignQueryCtx,
  sidebarItemId: Id<'sidebarItems'>,
): Promise<Array<ResourceShare>> {
  const [shares, projection] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', ctx.campaign._id).eq('sidebarItemId', sidebarItemId),
      )
      .collect(),
    loadSidebarItemShareIdentityProjection(ctx),
  ])
  return shares.map((share) => projectSidebarItemShare(share, projection.identities))
}

async function resolvePreviewIdentity(
  ctx: CampaignQueryCtx,
  item: SidebarItemEnhancementRow,
): Promise<{ assetId: AssetId | null; storageId: Id<'_storage'> | null }> {
  if ('previewStorageId' in item) {
    const storageId = item.previewStorageId ?? null
    return { assetId: await getAssetIdByStorageId(ctx.db, storageId), storageId }
  }
  const assetId = item.previewAssetId ?? null
  return { assetId, storageId: await getStorageIdByAssetId(ctx.db, assetId) }
}
