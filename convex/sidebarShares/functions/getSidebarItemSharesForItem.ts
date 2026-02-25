import type { CampaignQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemShare } from '../types'

export async function getSidebarItemSharesForItem(
  ctx: CampaignQueryCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<Array<SidebarItemShare>> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sidebarItemId', sidebarItemId),
    )
    .collect()
}
