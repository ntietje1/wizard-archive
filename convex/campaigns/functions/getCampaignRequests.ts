import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS } from '../types'
import { logger } from '../../common/logger'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { UserProfile } from '../../users/types'
import type { CampaignMember } from '../types'

export async function getCampaignRequests(ctx: DmQueryCtx): Promise<Array<CampaignMember>> {
  const campaignId = ctx.campaign._id

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()

  const nonAcceptedMembers = members.filter((m) => m.status !== CAMPAIGN_MEMBER_STATUS.Accepted)

  const profilesByUserId = new Map<Id<'userProfiles'>, UserProfile>()
  await asyncMap(nonAcceptedMembers, async (member) => {
    const profile = await getUserProfileById(ctx, { profileId: member.userId })
    if (profile) profilesByUserId.set(member.userId, profile)
  })

  return nonAcceptedMembers.flatMap((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      logger.error(`User profile not found for userId: ${member.userId}`)
      return []
    }
    return [{ ...member, userProfile: profile }]
  })
}
