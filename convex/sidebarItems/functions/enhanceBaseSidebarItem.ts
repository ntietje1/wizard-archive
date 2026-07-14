import { getSidebarItemPermissionLevel } from '../../sidebarShares/functions/sidebarItemPermissions'
import {
  assertResourceColor,
  assertResourceIconName,
} from '@wizard-archive/editor/resources/resource-contract'
import type {
  AnyResourceRow,
  ResourceShare,
} from '@wizard-archive/editor/resources/resource-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { AssetId, CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { assertConvexResourceTitle } from '../validation/name'
import { assertConvexSidebarItemSlug } from '../validation/slug'
import { getStorageIdByAssetId } from '../../storage/functions/assetIdentity'
import { isActiveSidebarItem, isTrashedSidebarItem } from '../types/status'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import {
  loadSidebarItemShareIdentityProjection,
  projectSidebarItemShare,
} from '../../sidebarShares/functions/projectSidebarItemShare'
import { findSidebarItemRow } from './sidebarItemIdentity'

type SidebarItemEnhancementRow = AnyResourceRow

export type SidebarItemEnhancement = {
  shares: Array<ResourceShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
}

function normalizeSidebarItemFields<T extends SidebarItemEnhancementRow>(
  item: T,
  previewAssetId: AssetId | null,
  campaignId: CampaignId,
) {
  return {
    ...item,
    campaignId,
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
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)
  const normalizedItem = normalizeSidebarItemFields(item, previewIdentity.assetId, campaignId)
  const providerItem = enhancement ? null : await findSidebarItemRow(ctx, normalizedItem.id)
  if (!enhancement && !providerItem) throw new Error('Resource provider row is missing')

  const [shares, isBookmarked, myPermissionLevel, previewUrl] = await Promise.all([
    enhancement
      ? enhancement.shares
      : membership.role === CAMPAIGN_MEMBER_ROLE.DM
        ? getResourceShares(ctx, providerItem!._id, normalizedItem.id)
        : [],
    enhancement
      ? enhancement.isBookmarked
      : ctx.db
          .query('bookmarks')
          .withIndex('by_campaign_member_item', (q) =>
            q
              .eq('campaignId', ctx.campaign._id)
              .eq('campaignMemberId', membership._id)
              .eq('sidebarItemId', providerItem!._id),
          )
          .unique()
          .then((bookmark) => bookmark !== null),
    enhancement?.myPermissionLevel ??
      getSidebarItemPermissionLevel(ctx, {
        item: {
          id: providerItem!._id,
          parentId: providerItem!.parentId,
          allPermissionLevel: providerItem!.allPermissionLevel,
        },
      }),
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
  resourceId: SidebarItemEnhancementRow['id'],
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
  return shares.map((share) => projectSidebarItemShare(share, projection.identities, resourceId))
}

async function resolvePreviewIdentity(
  ctx: CampaignQueryCtx,
  item: SidebarItemEnhancementRow,
): Promise<{ assetId: AssetId | null; storageId: Id<'_storage'> | null }> {
  const assetId = item.previewAssetId ?? null
  return { assetId, storageId: await getStorageIdByAssetId(ctx.db, assetId) }
}
