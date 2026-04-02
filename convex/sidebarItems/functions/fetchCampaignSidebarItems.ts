import { requireCampaignMembership } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignBookmarks } from '../../bookmarks/functions/getCampaignBookmarks'
import {
  getAllCampaignShares,
  getMemberShares,
} from '../../sidebarShares/functions/getCampaignShares'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { SidebarItemLocation } from '../types/baseTypes'
import type { AnySidebarItem, AnySidebarItemFromDb } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const fetchCampaignSidebarItems = async (
  ctx: AuthQueryCtx,
  {
    campaignId,
    location,
  }: { campaignId: Id<'campaigns'>; location: SidebarItemLocation },
): Promise<Array<AnySidebarItem>> => {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
  const hasFullAccess = membership.role === CAMPAIGN_MEMBER_ROLE.DM

  const [folders, notes, maps, files, canvases, bookmarkIds, sharesMap] =
    await Promise.all([
      ctx.db
        .query('folders')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location),
        )
        .collect(),
      ctx.db
        .query('notes')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location),
        )
        .collect(),
      ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location),
        )
        .collect(),
      ctx.db
        .query('files')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location),
        )
        .collect(),
      ctx.db
        .query('canvases')
        .withIndex('by_campaign_location_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('location', location),
        )
        .collect(),
      getCampaignBookmarks(ctx, campaignId, membership._id),
      hasFullAccess
        ? getAllCampaignShares(ctx, campaignId)
        : getMemberShares(ctx, campaignId, membership._id),
    ])

  const allItems: Array<AnySidebarItemFromDb> = [
    ...folders,
    ...notes,
    ...maps,
    ...files,
    ...canvases,
  ]

  return await Promise.all(
    allItems.map((item) =>
      enhanceSidebarItem(ctx, { item, sharesMap, bookmarkIds }),
    ),
  )
}
