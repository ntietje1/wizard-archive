import { requireCampaignMembership } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignBookmarks } from '../../bookmarks/functions/getCampaignBookmarks'
import {
  getAllCampaignShares,
  getMemberShares,
} from '../../sidebarShares/functions/getCampaignShares'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import { loadExtensionData } from './loadExtensionData'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const fetchCampaignSidebarItems = async (
  ctx: AuthQueryCtx,
  { campaignId, location }: { campaignId: Id<'campaigns'>; location: SidebarItemLocation },
): Promise<Array<AnySidebarItem>> => {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
  const hasFullAccess = membership.role === CAMPAIGN_MEMBER_ROLE.DM

  const [rawItems, bookmarkIds, sharesMap] = await Promise.all([
    ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q.eq('campaignId', campaignId).eq('location', location),
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
