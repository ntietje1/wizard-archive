import { CAMPAIGN_MEMBER_STATUS } from '../types'
import {
  getUserIdentity,
  getUserProfileByUsernameHandler,
} from '../../users/users'
import type {
  Campaign,
  CampaignFromDb,
  CampaignMember,
  CampaignMemberFromDb,
} from '../types'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

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

async function enhanceCampaign(
  ctx: QueryCtx,
  campaign: CampaignFromDb,
): Promise<Campaign> {
  const [dmUserProfile, playerCount] = await Promise.all([
    ctx.db.get(campaign.dmUserId),
    countAcceptedPlayers(ctx, campaign._id),
  ])
  if (!dmUserProfile) throw new Error('DM user profile not found')
  const identityWithProfile = await getUserIdentity(ctx)
  let myMembership: CampaignMember | undefined = undefined
  if (identityWithProfile) {
    const member: CampaignMemberFromDb | null = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q
          .eq('campaignId', campaign._id)
          .eq('userId', identityWithProfile.profile._id),
      )
      .unique()

    if (member) {
      myMembership = {
        ...member,
        userProfile: identityWithProfile.profile,
      }
    }
  }
  return { ...campaign, dmUserProfile, playerCount, myMembership }
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
  return enhanceCampaign(ctx, campaign)
}
