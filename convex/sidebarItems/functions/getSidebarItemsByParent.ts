import { requireCampaignMembership } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { getCampaignBookmarks } from '../../bookmarks/functions/getCampaignBookmarks'
import {
  getAllCampaignShares,
  getMemberShares,
} from '../../sidebarShares/functions/getCampaignShares'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { loadExtensionData } from './loadExtensionData'
import type { AnySidebarItem } from '../types/types'
import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export const getSidebarItemsByParent = async (
  ctx: AuthQueryCtx,
  { campaignId, parentId }: { campaignId: Id<'campaigns'>; parentId: Id<'sidebarItems'> | null },
): Promise<Array<AnySidebarItem>> => {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
  const hasFullAccess = membership.role === CAMPAIGN_MEMBER_ROLE.DM

  const [rawItems, bookmarkIds, sharesMap] = await Promise.all([
    ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', SIDEBAR_ITEM_LOCATION.sidebar)
          .eq('parentId', parentId),
      )
      .collect(),
    getCampaignBookmarks(ctx, campaignId, membership._id),
    hasFullAccess
      ? getAllCampaignShares(ctx, campaignId)
      : getMemberShares(ctx, campaignId, membership._id),
  ])

  const allItems = await loadExtensionData(ctx, rawItems)

  return await Promise.all(
    allItems.map((item) => enhanceSidebarItem(ctx, { item, sharesMap, bookmarkIds })),
  )
}
