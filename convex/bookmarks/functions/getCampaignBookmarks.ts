import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'

export async function getCampaignBookmarks(
  ctx: AuthQueryCtx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
): Promise<Set<SidebarItemId>> {
  const bookmarks = await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q.eq('campaignId', campaignId).eq('campaignMemberId', campaignMemberId),
    )
    .collect()
  return new Set(bookmarks.map((b) => b.sidebarItemId))
}
