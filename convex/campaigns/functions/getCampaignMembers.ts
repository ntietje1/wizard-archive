import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import type { UserProfile } from '../../users/types'
import type { CampaignMember } from '../types'

export async function getCampaignMembers(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Array<CampaignMember>> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
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
      throw new Error('User profile not found')
    }
    return {
      ...member,
      userProfile: profile,
    }
  })
}
