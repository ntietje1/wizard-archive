import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../types'
import {
  getUserProfileById,
  getUserProfileByUserId,
  getUserProfileByUsername,
} from '../../users/functions/getUserProfile'
import type { AuthQueryCtx } from '../../functions'
import type { Campaign, CampaignFromDb, CampaignMember, CampaignMemberFromDb } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

async function countAcceptedPlayers(
  ctx: QueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<number> {
  const members = await ctx.db
    .query('campaignMembers')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
    .collect()
  return members.filter((m) => m.status === CAMPAIGN_MEMBER_STATUS.Accepted).length
}

async function enhanceCampaign(
  ctx: QueryCtx,
  { campaign }: { campaign: CampaignFromDb },
): Promise<Campaign> {
  const [dmUserProfile, playerCount] = await Promise.all([
    getUserProfileById(ctx, { profileId: campaign.dmUserId }),
    countAcceptedPlayers(ctx, { campaignId: campaign._id }),
  ])
  if (!dmUserProfile) throw new Error('DM user profile not found')
  const identity = await ctx.auth.getUserIdentity()
  let myMembership: CampaignMember | null = null
  if (identity) {
    const profile = await getUserProfileByUserId(ctx, {
      userId: identity.subject,
    })
    if (!profile) throw new Error('User profile not found')
    const member: CampaignMemberFromDb | null = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaign._id).eq('userId', profile._id),
      )
      .unique()

    if (member && member.status !== CAMPAIGN_MEMBER_STATUS.Removed) {
      myMembership = {
        ...member,
        userProfile: profile,
      }
    }
  }
  return { ...campaign, dmUserProfile, playerCount, myMembership }
}

// NOTE: No membership check here — callers need to verify membership
export async function getCampaign(
  ctx: AuthQueryCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<Campaign | null> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted) return null
  return enhanceCampaign(ctx, { campaign })
}

// is public for the join campaign screen
export async function getCampaignBySlug(
  ctx: QueryCtx,
  { dmUsername, slug }: { dmUsername: string; slug: string },
): Promise<Campaign> {
  const dmUserProfile = await getUserProfileByUsername(ctx, {
    username: dmUsername,
  })
  if (!dmUserProfile) throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  const campaign = await ctx.db
    .query('campaigns')
    .withIndex('by_slug_dm', (q) => q.eq('slug', slug).eq('dmUserId', dmUserProfile._id))
    .unique()
  if (!campaign || campaign.status === CAMPAIGN_STATUS.Deleted)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Campaign not found')
  return enhanceCampaign(ctx, { campaign })
}
