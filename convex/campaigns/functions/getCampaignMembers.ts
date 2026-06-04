import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS } from '../../../shared/campaigns/types'
import { logger } from '../../common/logger'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { UserProfile, UserProfileSummary } from '../../../shared/users/types'
import type { CampaignMemberSummary } from '../../../shared/campaigns/types'

function toUserProfileSummary(profile: UserProfile): UserProfileSummary {
  return {
    name: profile.name,
    username: profile.username,
    imageUrl: profile.imageUrl,
  }
}

export async function getCampaignMembers(
  ctx: CampaignQueryCtx,
): Promise<Array<CampaignMemberSummary>> {
  const campaignId = ctx.campaign._id

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()
  const activeMembers = members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted)
  const profilesByUserId = new Map<Id<'userProfiles'>, UserProfileSummary>()
  await asyncMap(activeMembers, async (member) => {
    const profile = await getUserProfileById(ctx, {
      profileId: member.userId,
    })
    if (profile) profilesByUserId.set(member.userId, toUserProfileSummary(profile))
  })
  return activeMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.warn(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [
      {
        ...member,
        userProfile: profile,
      },
    ]
  })
}
