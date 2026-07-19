import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from '../../../shared/campaigns/types'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { requireCampaignRow } from './campaignIdentity'
import type { CampaignMemberStatus } from '../../../shared/campaigns/types'
import type { AuthMutationCtx } from '../../functions'

export async function joinCampaign(
  ctx: AuthMutationCtx,
  { campaignId }: { campaignId: CampaignId },
): Promise<CampaignMemberStatus> {
  const profile = ctx.user.profile
  const campaign = await requireCampaignRow(ctx, campaignId)

  if (campaign.status !== CAMPAIGN_STATUS.Active) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'This campaign is not accepting new members')
  }

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
    campaignMemberUuid: generateDomainId(DOMAIN_ID_KIND.campaignMember),
    userId: profile._id,
    campaignId: campaign._id,
    role: CAMPAIGN_MEMBER_ROLE.Player,
    status: CAMPAIGN_MEMBER_STATUS.Pending,
  })

  return CAMPAIGN_MEMBER_STATUS.Pending
}
