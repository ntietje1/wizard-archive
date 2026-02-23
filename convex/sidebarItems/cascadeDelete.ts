import type { SidebarItemId } from './baseTypes'
import type { CampaignMutationCtx } from '../functions'

export async function deleteItemSharesAndBookmarks(
  ctx: CampaignMutationCtx,
  sidebarItemId: SidebarItemId,
): Promise<void> {
  const campaignId = ctx.campaign._id

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  for (const share of shares) {
    await ctx.db.delete(share._id)
  }

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_item', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  for (const bookmark of bookmarks) {
    await ctx.db.delete(bookmark._id)
  }
}
