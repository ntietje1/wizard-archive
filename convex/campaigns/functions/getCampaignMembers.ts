import { requireCampaignMembership } from '../../functions'
import { logger } from '../../common/logger'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { UserProfile } from '../../users/types'
import type { CampaignMember } from '../types'

export async function getCampaignMembers(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Array<CampaignMember>> {
  await requireCampaignMembership(ctx, campaignId)

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
  return members.flatMap((member) => {
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
