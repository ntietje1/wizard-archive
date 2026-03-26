import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS } from '../types'
import { getCampaignBySlug } from './getCampaign'
import type { CampaignMemberStatus } from '../types'
import type { AuthMutationCtx } from '../../functions'

export async function joinCampaign(
  ctx: AuthMutationCtx,
  { dmUsername, slug }: { dmUsername: string; slug: string },
): Promise<CampaignMemberStatus> {
  const profile = ctx.user.profile
  const campaign = await getCampaignBySlug(ctx, { dmUsername, slug })

  const existingMember = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaign._id).eq('userId', profile._id),
    )
    .unique()

  if (existingMember) {
    return existingMember.status
  }

  await ctx.db.insert('campaignMembers', {
    userId: profile._id,
    campaignId: campaign._id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Pending,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profile._id,
  })

  return CAMPAIGN_MEMBER_STATUS.Pending
}
