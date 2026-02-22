import { v } from 'convex/values'
import { findUniqueSlug } from '../common/slug'
import { authMutation, dmMutation } from '../functions'
import { getCampaignBySlug } from './campaigns'
import { campaignMemberStatusValidator } from './schema'
import {
  CAMPAIGN_MEMBER_ROLE,
  CAMPAIGN_MEMBER_STATUS,
  CAMPAIGN_STATUS,
} from './types'
import type { Id } from '../_generated/dataModel'
import type { CampaignMemberStatus } from './types'

export const createCampaign = authMutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    slug: v.string(),
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    const profile = ctx.user.profile

    const now = Date.now()

    const uniqueSlug = await findUniqueSlug(args.slug, async (slug) => {
      const conflict = await ctx.db
        .query('campaigns')
        .withIndex('by_slug_dm', (q) =>
          q.eq('slug', slug).eq('dmUserId', profile._id),
        )
        .unique()
      return conflict !== null
    })

    const campaignId = await ctx.db.insert('campaigns', {
      name: args.name,
      description: args.description,
      updatedAt: now,
      playerCount: 0,
      dmUserId: profile._id,
      slug: uniqueSlug,
      status: CAMPAIGN_STATUS.Active,
    })

    await ctx.db.insert('campaignMembers', {
      userId: profile._id,
      campaignId,
      role: CAMPAIGN_MEMBER_ROLE.DM,
      status: CAMPAIGN_MEMBER_STATUS.Accepted,
      updatedAt: now,
    })

    return campaignId
  },
})

export const joinCampaign = authMutation({
  args: {
    dmUsername: v.string(),
    slug: v.string(),
  },
  returns: campaignMemberStatusValidator,
  handler: async (ctx, args): Promise<CampaignMemberStatus> => {
    const profile = ctx.user.profile
    const campaign = await getCampaignBySlug(ctx, args.dmUsername, args.slug)

    const campaignMembers = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaign._id))
      .collect()

    if (campaignMembers.some((member) => member.userId === profile._id)) {
      return campaignMembers.find((member) => member.userId === profile._id)!
        .status
    }

    const now = Date.now()

    await ctx.db.insert('campaignMembers', {
      userId: profile._id,
      campaignId: campaign._id,
      role: CAMPAIGN_MEMBER_ROLE.Player,
      status: CAMPAIGN_MEMBER_STATUS.Pending,
      updatedAt: now,
    })

    return CAMPAIGN_MEMBER_STATUS.Pending
  },
})

export const updateCampaign = dmMutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    slug: v.optional(v.string()),
  },
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    const profile = ctx.user.profile
    const campaign = ctx.campaign

    const now = Date.now()

    const campaignUpdates: {
      name?: string
      description?: string
      slug?: string
      updatedAt: number
    } = {
      updatedAt: now,
    }

    if (args.name !== undefined) {
      campaignUpdates.name = args.name
    }
    if (args.description !== undefined) {
      campaignUpdates.description = args.description
    }

    if (args.slug !== undefined && args.slug !== campaign.slug) {
      const uniqueSlug = await findUniqueSlug(args.slug, async (slug) => {
        const conflict = await ctx.db
          .query('campaigns')
          .withIndex('by_slug_dm', (q) =>
            q.eq('slug', slug).eq('dmUserId', profile._id),
          )
          .unique()
        return conflict !== null && conflict._id !== campaign._id
      })
      campaignUpdates.slug = uniqueSlug
    }

    await ctx.db.patch(campaign._id, campaignUpdates)

    return campaign._id
  },
})

export const deleteCampaign = dmMutation({
  args: {},
  returns: v.id('campaigns'),
  handler: async (ctx, args): Promise<Id<'campaigns'>> => {
    // Delete blocks
    const blocks = await ctx.db
      .query('blocks')
      .withIndex('by_campaign_note_block', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const block of blocks) {
      await ctx.db.delete(block._id)
    }

    // Delete notes
    const notes = await ctx.db
      .query('notes')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const note of notes) {
      await ctx.db.delete(note._id)
    }

    // Delete folders
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const folder of folders) {
      await ctx.db.delete(folder._id)
    }

    // Delete maps and pins
    const maps = await ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const map of maps) {
      const pins = await ctx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', map._id))
        .collect()
      for (const pin of pins) {
        await ctx.db.delete(pin._id)
      }
      await ctx.db.delete(map._id)
    }

    // Delete files
    const files = await ctx.db
      .query('files')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const file of files) {
      await ctx.db.delete(file._id)
    }

    // Delete sidebar item shares
    const sidebarItemShares = await ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const share of sidebarItemShares) {
      await ctx.db.delete(share._id)
    }

    // Delete block shares
    const blockShares = await ctx.db
      .query('blockShares')
      .withIndex('by_campaign_block_member', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const share of blockShares) {
      await ctx.db.delete(share._id)
    }

    // Delete sessions
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (q) =>
        q.eq('campaignId', args.campaignId),
      )
      .collect()

    for (const session of sessions) {
      await ctx.db.delete(session._id)
    }

    // Delete campaign members
    const campaignMembers = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign', (q) => q.eq('campaignId', args.campaignId))
      .collect()

    for (const member of campaignMembers) {
      await ctx.db.delete(member._id)
    }

    await ctx.db.delete(args.campaignId)

    return args.campaignId
  },
})

export const updateCampaignMemberStatus = dmMutation({
  args: {
    memberId: v.id('campaignMembers'),
    status: campaignMemberStatusValidator,
  },
  returns: v.id('campaignMembers'),
  handler: async (ctx, args): Promise<Id<'campaignMembers'>> => {
    const member = await ctx.db.get(args.memberId)
    if (!member || member.campaignId !== args.campaignId) {
      throw new Error('Member not found')
    }

    if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) {
      throw new Error('Only player membership status can be changed')
    }

    const now = Date.now()
    await ctx.db.patch(member._id, { status: args.status, updatedAt: now })

    if (
      args.status === CAMPAIGN_MEMBER_STATUS.Accepted &&
      member.status !== CAMPAIGN_MEMBER_STATUS.Accepted
    ) {
      await ctx.db.patch(args.campaignId, {
        playerCount: Math.max(0, ctx.campaign.playerCount + 1),
        updatedAt: now,
      })
    } else if (
      args.status === CAMPAIGN_MEMBER_STATUS.Removed &&
      member.status === CAMPAIGN_MEMBER_STATUS.Accepted
    ) {
      await ctx.db.patch(args.campaignId, {
        playerCount: Math.max(0, ctx.campaign.playerCount - 1),
        updatedAt: now,
      })
    }

    return member._id
  },
})
