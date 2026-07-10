import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { StoredSidebarItemSharePatchRow } from './deltas'

export async function getSidebarItemShareRow(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<StoredSidebarItemSharePatchRow | null> {
  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
  if (!share) return null
  return {
    _id: share._id,
    _creationTime: share._creationTime,
    campaignId: share.campaignId,
    sidebarItemId: share.sidebarItemId,
    sidebarItemType: share.sidebarItemType,
    campaignMemberId: share.campaignMemberId,
    sessionId: share.sessionId,
    permissionLevel: share.permissionLevel,
  }
}
