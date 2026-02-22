import { getUserProfileByUsernameHandler } from '../users/users'
import { CAMPAIGN_MEMBER_STATUS } from './types'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { UserProfile } from '../users/types'
import type { Campaign, CampaignFromDb, CampaignMember } from './types'

async function countAcceptedPlayers(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<number> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()
  return members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted)
    .length
}

export async function enhanceCampaign(
  ctx: QueryCtx,
  campaign: CampaignFromDb,
): Promise<Campaign> {
  const [dmUserProfile, playerCount] = await Promise.all([
    ctx.db.get(campaign.dmUserId),
    countAcceptedPlayers(ctx, campaign._id),
  ])
  if (!dmUserProfile) throw new Error('DM user profile not found')
  return { ...campaign, dmUserProfile, playerCount }
}

export async function getCampaign(
  ctx: QueryCtx,
  campaignId: Id<'campaigns'>,
): Promise<Campaign | null> {
  const campaign = await ctx.db.get(campaignId)
  if (!campaign) return null
  return enhanceCampaign(ctx, campaign)
}

export async function getCampaignBySlug(
  ctx: QueryCtx,
  dmUsername: string,
  slug: string,
): Promise<Campaign> {
  const dmUserProfile = await getUserProfileByUsernameHandler(ctx, dmUsername)
  if (!dmUserProfile) throw new Error('DM user not found')
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) =>
      q.eq('slug', slug).eq('dmUserId', dmUserProfile._id),
    )
    .unique()
  if (!campaign) throw new Error('Campaign not found')
  const playerCount = await countAcceptedPlayers(ctx, campaign._id)
  return { ...campaign, dmUserProfile, playerCount }
}

export async function getCampaignMember(
  ctx: QueryCtx,
  memberId: Id<'campaignMembers'>,
): Promise<CampaignMember | null> {
  const member = await ctx.db.get(memberId)
  if (!member) {
    return null
  }
  const userProfile = await ctx.db.get(member.userId)
  if (!userProfile) {
    throw new Error('User profile not found')
  }
  return {
    ...member,
    userProfile,
  }
}

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
