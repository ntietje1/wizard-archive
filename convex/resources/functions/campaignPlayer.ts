import type { CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import type { CampaignMutationCtx } from '../../functions'

export async function isAcceptedCampaignPlayer(
  ctx: CampaignMutationCtx,
  memberId: CampaignMemberId,
): Promise<boolean> {
  const member = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaignMemberUuid', (query) => query.eq('campaignMemberUuid', memberId))
    .unique()
  return (
    member?.campaignId === ctx.campaign._id &&
    member.role === CAMPAIGN_MEMBER_ROLE.Player &&
    member.status === CAMPAIGN_MEMBER_STATUS.Accepted
  )
}
