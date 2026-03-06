import { requireCampaignMembership } from '../../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignBookmarks } from '../../bookmarks/functions/getCampaignBookmarks'
import {
  getAllCampaignShares,
  getMemberShares,
} from '../../sidebarShares/functions/getCampaignShares'
import { enhanceSidebarItem } from './enhanceSidebarItem'
import type { AnySidebarItem, AnySidebarItemFromDb } from '../types/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const getAllSidebarItems = async (
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Array<AnySidebarItem>> => {
  const { membership } = await requireCampaignMembership(ctx, campaignId)
  const hasFullAccess = membership.role === CAMPAIGN_MEMBER_ROLE.DM

  const [folders, notes, maps, files, bookmarkIds, sharesMap] =
    await Promise.all([
      ctx.db
        .query('folders')
        .withIndex('by_campaign_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('deletionTime', undefined),
        )
        .collect(),
      ctx.db
        .query('notes')
        .withIndex('by_campaign_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('deletionTime', undefined),
        )
        .collect(),
      ctx.db
        .query('gameMaps')
        .withIndex('by_campaign_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('deletionTime', undefined),
        )
        .collect(),
      ctx.db
        .query('files')
        .withIndex('by_campaign_parent_name', (q) =>
          q.eq('campaignId', campaignId).eq('deletionTime', undefined),
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
  ]

  return await Promise.all(
    allItems.map((item) =>
      enhanceSidebarItem(ctx, { item, sharesMap, bookmarkIds }),
    ),
  )
}
