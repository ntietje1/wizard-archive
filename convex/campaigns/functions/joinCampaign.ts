import { CAMPAIGN_MEMBER_ROLE, CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { getCampaignBySlug } from './getCampaign'
import type { CampaignMemberStatus } from '../types'
import type { AuthMutationCtx } from '../../functions'

export async function joinCampaign(
  ctx: AuthMutationCtx,
  { dmUsername, slug }: { dmUsername: string; slug: string },
): Promise<CampaignMemberStatus> {
  const profile = ctx.user.profile
  const campaign = await getCampaignBySlug(ctx, { dmUsername, slug })

  if (campaign.status !== CAMPAIGN_STATUS.Active) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This campaign is not accepting new members')
  }

  const existingMember = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaign._id).eq('userId', profile._id),
    )
    .unique()

  if (existingMember && existingMember.deletionTime === null) {
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
