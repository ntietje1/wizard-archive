import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Bookmark } from '../types'

export async function getItemBookmark(
  ctx: AuthQueryCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<Bookmark | null> {
  const item = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!item) return null

  const { membership } = await requireCampaignMembership(ctx, item.campaignId)

  return await ctx.db
    .query('bookmarks')
    .withIndex('by_campaign_member_item', (q) =>
      q
        .eq('campaignId', item.campaignId)
        .eq('campaignMemberId', membership._id)
        .eq('sidebarItemId', sidebarItemId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .first()
}
