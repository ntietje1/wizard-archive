import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { UserProfile } from '../../users/types'
import type { CampaignMember } from '../types'

export async function getCampaignMembers(
  ctx: CampaignQueryCtx,
): Promise<Array<CampaignMember>> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', ctx.campaign._id))
    .collect()
  const profilesByUserId = new Map<Id<'userProfiles'>, UserProfile>()
  await Promise.all(
    members.map(async (member) => {
      const profile = await ctx.db.get(member.userId)
      if (profile) profilesByUserId.set(member.userId, profile)
    }),
  )
  return members.map((member) => {
    const profile = profilesByUserId.get(member.userId)
    if (!profile) {
      throw new Error(`User profile not found for userId: ${member.userId}`)
    }
    return {
      ...member,
      userProfile: profile,
    }
  })
}
