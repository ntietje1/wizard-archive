import type { CampaignQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Bookmark } from '../types'

export async function getItemBookmark(
  ctx: CampaignQueryCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
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
