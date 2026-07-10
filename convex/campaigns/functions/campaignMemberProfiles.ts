import { asyncMap } from 'convex-helpers'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'
import type { UserProfile } from '../../../shared/users/types'

type CampaignMemberProfileCtx = CampaignQueryCtx

export async function getCampaignMemberRows(
  ctx: CampaignMemberProfileCtx,
): Promise<Array<CampaignMemberRow>> {
  return await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', ctx.campaign._id))
    .collect()
}

export async function loadProfilesByMemberUserId<Profile>(
  ctx: CampaignMemberProfileCtx,
  members: Array<CampaignMemberRow>,
  mapProfile: (profile: UserProfile) => Profile,
): Promise<Map<Id<'userProfiles'>, Profile>> {
  const profilesByUserId = new Map<Id<'userProfiles'>, Profile>()
  await asyncMap(members, async (member) => {
    const profile = await getUserProfileById(ctx, { profileId: member.userId })
    if (profile) profilesByUserId.set(member.userId, mapProfile(profile))
  })
  return profilesByUserId
}
