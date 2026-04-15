import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Bookmark } from '../types'

export async function getItemBookmark(
  ctx: CampaignQueryCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
): Promise<Bookmark | null> {
  const item = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!item) return null

  return await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', item.campaignId)
        .eq('campaignMemberId', ctx.membership._id)
        .eq('sidebarItemId', sidebarItemId),
    )
    .first()
}
