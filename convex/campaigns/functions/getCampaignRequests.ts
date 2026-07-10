import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { logger } from '../../common/logger'
import { getCampaignMemberRows, loadProfilesByMemberUserId } from './campaignMemberProfiles'
import type { DmQueryCtx } from '../../functions'
import type { UserProfile } from '../../../shared/users/types'
import type { CampaignMember, CampaignMemberRow } from '../../../shared/campaigns/types'

function toCampaignMember(member: CampaignMemberRow, userProfile: UserProfile): CampaignMember {
  const { _id, _creationTime, ...fields } = member
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
    userProfile,
  }
}

export async function getCampaignRequests(ctx: DmQueryCtx): Promise<Array<CampaignMember>> {
  const members = await getCampaignMemberRows(ctx)
  const nonAcceptedMembers = members.filter((m) => m.status !== CAMPAIGN_MEMBER_STATUS.Accepted)
  const profilesByUserId = await loadProfilesByMemberUserId(
    ctx,
    nonAcceptedMembers,
    (profile) => profile,
  )

  return nonAcceptedMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.error(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [toCampaignMember(member, profile)]
  })
}
