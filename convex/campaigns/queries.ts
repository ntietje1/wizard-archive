import { v } from 'convex/values'
import { query } from '../_generated/server'
import {
  Campaign,
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CampaignMember,
  CampaignWithMembership,
} from './types'
import { getUserIdentity, requireUserIdentity } from '../common/identity'
import { Note, SIDEBAR_ITEM_TYPES } from '../notes/types'
import {
  getCampaign,
  getCampaignMember,
  requireCampaignMembership,
} from './campaigns'
import { getUserProfileByUsernameHandler } from '../users/users'

export const getUserCampaigns = query({
  handler: async (ctx): Promise<CampaignWithMembership[]> => {
    const { profile } = await requireUserIdentity(ctx)

    const campaignMemberships = await ctx.db
      .query('campaignMembers')
      .withIndex('by_user', (q) => q.eq('userId', profile.userId))
      .collect()
      .then((memberships) =>
        memberships.filter(
          (membership) => membership.status === CAMPAIGN_MEMBER_STATUS.Accepted,
        ),
      )

    const campaigns = await Promise.all(
      campaignMemberships.map((membership) =>
        getCampaign(ctx, { campaignId: membership.campaignId }),
      ),
    )

    const campaignsWithNotes = await Promise.all(
      campaigns.map(async (campaign) => {
        const membership = campaignMemberships.find(
          (membership) => membership.campaignId === campaign._id,
        )

        if (!membership) {
          return null
        }

        let notes: Note[] | undefined = undefined
        if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
          const rawNotes = await ctx.db
            .query('notes')
            .withIndex('by_campaign_category_parent', (q) =>
              q.eq('campaignId', campaign._id),
            )
            .collect()
          notes = rawNotes.map((note) => ({
            ...note,
            type: SIDEBAR_ITEM_TYPES.notes,
          })) as Note[]
        }

        return {
          campaign,
          member: {
            ...membership,
            userProfile: profile,
          },
          noteCount: notes?.length || 0,
        }
      }),
    ).then((campaigns) => campaigns.filter((campaign) => campaign !== null))

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
    const dmUserProfile = await getUserProfileByUsernameHandler(
      ctx,
      args.dmUsername,
    )
    if (!dmUserProfile) {
      throw new Error('DM user not found')
    }

    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', args.slug).eq('dmUserId', dmUserProfile.userId),
      )
      .unique()

    if (!campaign) {
      throw new Error('Campaign not found')
    }

    let campaignMember: CampaignMember | undefined = undefined
    if (identityWithProfile) {
      const members = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
        .collect()

      const member = members.find(
        (member) => member.userId === identityWithProfile.profile.userId,
      )

      if (member) {
        campaignMember = {
          ...member,
          userProfile: identityWithProfile.profile,
        }
      }
    }

    return {
      campaign: {
        ...campaign,
        dmUserProfile,
      },
      campaignMember,
    }
  },
})

export const getCampaignBySlug = query({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, args): Promise<CampaignWithMembership> => {
    const { campaignWithMembership } = await requireCampaignMembership(ctx, {
      dmUsername: args.dmUsername,
      campaignSlug: args.slug,
    })
    return campaignWithMembership
  },
})

export const checkCampaignSlugExists = query({
  args: {
    slug: v.string(),
    excludeCampaignId: v.optional(v.id('campaigns')),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const { profile } = await requireUserIdentity(ctx)

    const existingCampaign = await ctx.db
      .query('campaigns')
      .withIndex('by_slug_dm', (q) =>
        q.eq('slug', args.slug).eq('dmUserId', profile.userId),
      )
      .unique()

    if (!existingCampaign) {
      return false
    }

    // If we're editing an existing campaign, treat the same campaign as "not existing"
    if (
      args.excludeCampaignId &&
      existingCampaign._id === args.excludeCampaignId
    ) {
      return false
    }

    return true
  },
})

export const getPlayersByCampaign = query({
  args: { campaignId: v.id('campaigns') },
  handler: async (ctx, args): Promise<CampaignMember[]> => {
    const { campaignWithMembership } = await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const { campaign } = campaignWithMembership

    const members = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .collect()

    const membersWithProfiles = await Promise.all(
      members.map(async (member) => {
        return getCampaignMember(ctx, member._id)
      }),
    ).then((members) => members.filter((member) => member !== null))

    return membersWithProfiles
  },
})
