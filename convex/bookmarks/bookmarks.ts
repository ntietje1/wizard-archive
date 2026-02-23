import type { SidebarItemId } from '../sidebarItems/baseTypes'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../functions'
import type { Bookmark } from './types'

export async function getBookmark(
  ctx: CampaignQueryCtx,
  sidebarItemId: SidebarItemId,
): Promise<Bookmark | null> {
  return await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('campaignMemberId', ctx.membership._id)
        .eq('sidebarItemId', sidebarItemId),
    )
    .unique()
}

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
