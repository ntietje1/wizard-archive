import { v } from 'convex/values'
import { query } from '../_generated/server'
import { getUserIdentity } from '../users/users'
import { authQuery, campaignQuery } from '../functions'
import { CAMPAIGN_MEMBER_STATUS } from './types'
import {
  getCampaign,
  getCampaignBySlug as getCampaignBySlugHelper,
  getCampaignMembers,
} from './campaigns'
import {
  campaignMemberValidator,
  campaignWithMembershipValidator,
} from './schema'
import type { Campaign, CampaignMember, CampaignWithMembership } from './types'

export const getUserCampaigns = authQuery({
  args: {
    campaignId: v.id('campaigns'),
  },
  returns: v.array(campaignWithMembershipValidator),
  handler: async (ctx): Promise<Array<CampaignWithMembership>> => {
    const profile = ctx.user.profile

    const campaignMemberships = await ctx.db
      .query('campaignMembers')
      .withIndex('by_user', (q) => q.eq('userId', profile._id))
      .collect()
      .then((memberships) =>
        memberships.filter(
          (membership) => membership.status === CAMPAIGN_MEMBER_STATUS.Accepted,
        ),
      )

    const results = await Promise.all(
      campaignMemberships.map(async (membership) => {
        const campaign = await getCampaign(ctx, membership.campaignId)
        if (!campaign) return null
        return {
          campaign,
          member: { ...membership, userProfile: profile },
        }
      }),
    )

    return results.filter((r) => r !== null)
  },
})

export const getPublicCampaignBySlug = query({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    campaign: Campaign
    campaignMember?: CampaignMember | null
  }> => {
    const identityWithProfile = await getUserIdentity(ctx)
    const campaign = await getCampaignBySlugHelper(
      ctx,
      args.dmUsername,
      args.slug,
    )

    let campaignMember: CampaignMember | undefined = undefined
    if (identityWithProfile) {
      const member = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) =>
          q
            .eq('campaignId', campaign._id)
            .eq('userId', identityWithProfile.profile._id),
        )
        .unique()

      if (member) {
        campaignMember = {
          ...member,
          userProfile: identityWithProfile.profile,
        }
      }
    }

    return {
      campaign,
      campaignMember,
    }
  },
})

export const getCampaignBySlug = authQuery({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  returns: campaignWithMembershipValidator,
  handler: async (ctx, args): Promise<CampaignWithMembership> => {
    const campaign = await getCampaignBySlugHelper(
      ctx,
      args.dmUsername,
      args.slug,
    )
    const member = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaign._id).eq('userId', ctx.user.profile._id),
      )
      .unique()
    if (!member || member.status !== CAMPAIGN_MEMBER_STATUS.Accepted)
      throw new Error('Not a campaign member')
    return {
      campaign,
      member: { ...member, userProfile: ctx.user.profile },
    }
  },
})

export const checkCampaignSlugExists = authQuery({
  args: {
    slug: v.string(),
    excludeCampaignId: v.optional(v.id('campaigns')),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const existingCampaign = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', args.slug).eq('dmUserId', ctx.user.profile._id),
      )
      .unique()

    if (!existingCampaign) {
      return false
    }

    if (
      args.excludeCampaignId &&
      existingCampaign._id === args.excludeCampaignId
    ) {
      return false
    }

    return true
  },
})

export const getPlayersByCampaign = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.array(campaignMemberValidator),
  handler: async (ctx, _args): Promise<Array<CampaignMember>> => {
    return getCampaignMembers(ctx, ctx.campaign._id)
  },
})
