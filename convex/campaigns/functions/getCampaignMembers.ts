import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { logger } from '../../common/logger'
import { toUserProfileSummary } from '../../users/functions/profileSummary'
import { getCampaignMemberRows, loadProfilesByMemberUserId } from './campaignMemberProfiles'
import type { CampaignQueryCtx } from '../../functions'
import type { UserProfileSummary } from '../../../shared/users/types'
import type { CampaignMemberRow, CampaignMemberSummary } from '../../../shared/campaigns/types'

function toCampaignMemberSummary(
  member: CampaignMemberRow,
  userProfile: UserProfileSummary,
): CampaignMemberSummary {
  const { _id, _creationTime, ...fields } = member
  return {
    ...fields,
    id: _id,
    createdAt: _creationTime,
    userProfile,
  }
}

export async function getCampaignMembers(
  ctx: CampaignQueryCtx,
): Promise<Array<CampaignMemberSummary>> {
  const members = await getCampaignMemberRows(ctx)
  const activeMembers = members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted)
  const profilesByUserId = await loadProfilesByMemberUserId(
    ctx,
    activeMembers,
    toUserProfileSummary,
  )
  return activeMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.warn(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [toCampaignMemberSummary(member, profile)]
  })
}
