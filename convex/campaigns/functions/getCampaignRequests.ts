import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { logger } from '../../common/logger'
import { getCampaignMemberRows, loadProfilesByMemberUserId } from './campaignMemberProfiles'
import type { DmQueryCtx } from '../../functions'
import type { CampaignMember } from '../../../shared/campaigns/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { toCampaignMemberProjection } from './campaignMemberProjection'

export async function getCampaignRequests(ctx: DmQueryCtx): Promise<Array<CampaignMember>> {
  const members = await getCampaignMemberRows(ctx)
  const nonAcceptedMembers = members.filter((m) => m.status !== CAMPAIGN_MEMBER_STATUS.Accepted)
  const profilesByUserId = await loadProfilesByMemberUserId(ctx, nonAcceptedMembers)
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, ctx.campaign.campaignUuid)

  return nonAcceptedMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.error(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [toCampaignMemberProjection(member, campaignId, profile.id, profile)]
  })
}
