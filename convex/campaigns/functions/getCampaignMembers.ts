import { asyncMap } from 'convex-helpers'
import { logger } from '../../common/logger'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { UserProfile } from '../../users/types'
import type { CampaignMember } from '../types'

export async function getCampaignMembers(ctx: CampaignQueryCtx): Promise<Array<CampaignMember>> {
  const campaignId = ctx.campaign._id

  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()
  const activeMembers = members.filter((m) => m.deletionTime === null)
  const profilesByUserId = new Map<Id<'userProfiles'>, UserProfile>()
  await asyncMap(activeMembers, async (member) => {
    const profile = await getUserProfileById(ctx, {
      profileId: member.userId,
    })
    if (profile) profilesByUserId.set(member.userId, profile)
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
