import type { CampaignMutationCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/baseTypes'

export async function deleteItemBookmarks(
  ctx: CampaignMutationCtx,
  sidebarItemId: SidebarItemId,
): Promise<void> {
  const campaignId = ctx.campaign._id

  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_item', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  await Promise.all(bookmarks.map((bookmark) => ctx.db.delete(bookmark._id)))
}
