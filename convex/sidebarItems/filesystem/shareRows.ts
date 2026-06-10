import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { SidebarItemSharePatchRow } from '../../../shared/sidebar-items/filesystem/receipts'

export async function getSidebarItemShareRow(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<SidebarItemSharePatchRow | null> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
}
