import type { SidebarItemId } from '../sidebarItems/types'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { Bookmark } from './types'

export async function getBookmark(
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  campaignMemberId: Id<'campaignMembers'>,
  sidebarItemId: SidebarItemId,
): Promise<Bookmark | null> {
  return await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('campaignMemberId', campaignMemberId)
        .eq('sidebarItemId', sidebarItemId),
    )
    .unique()
}
