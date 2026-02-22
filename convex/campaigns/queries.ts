import { v } from 'convex/values'
import { query } from '../_generated/server'
import { getUserIdentity } from '../common/identity'
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

    const campaigns = await Promise.all(
      campaignMemberships.map((membership) =>
        getCampaign(ctx, membership.campaignId),
      ),
    )

    const campaignsWithNotes = await Promise.all(
      campaigns.map((campaign) => {
        const membership = campaignMemberships.find(
          (m) => m.campaignId === campaign._id,
        )

        if (!membership) {
          return null
        }

        return {
          campaign,
          member: {
            ...membership,
            userProfile: profile,
          },
        }
      }),
    ).then((filteredCampaigns) =>
      filteredCampaigns.filter((campaign) => campaign !== null),
    )

    return campaignsWithNotes
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
      const members = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .collect()

      const member = members.find(
        (m) => m.userId === identityWithProfile.profile._id,
      )

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
    const members = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .collect()
    const member = members.find(
      (m) =>
        m.userId === ctx.user.profile._id &&
        m.status === CAMPAIGN_MEMBER_STATUS.Accepted,
    )
    if (!member) throw new Error('Not a campaign member')
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
  returns: v.array(campaignMemberValidator),
  handler: async (ctx, _args): Promise<Array<CampaignMember>> => {
    return getCampaignMembers(ctx, ctx.campaign._id)
  },
})
