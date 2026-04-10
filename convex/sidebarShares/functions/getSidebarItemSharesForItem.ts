import { ERROR_CODE, throwClientError } from '../../errors'
import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemShare } from '../types'

export async function getSidebarItemSharesForItem(
  ctx: AuthQueryCtx,
  { sidebarItemId }: { sidebarItemId: Id<'sidebarItems'> },
): Promise<Array<SidebarItemShare>> {
  const item = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireCampaignMembership(ctx, item.campaignId)

  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', item.campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()
}
