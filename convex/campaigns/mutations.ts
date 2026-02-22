import { v } from 'convex/values'
import { findUniqueSlug } from '../common/slug'
import { deleteFile } from '../files/files'
import { deleteFolder } from '../folders/folders'
import { deleteMap } from '../gameMaps/gameMaps'
import { deleteNote } from '../notes/notes'
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

    const existingMember = await ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) =>
        q.eq('campaignId', campaign._id).eq('userId', profile._id),
      )
      .unique()

    if (existingMember) {
      return existingMember.status
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
    const folders = await ctx.db
      .query('folders')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId).eq('parentId', undefined),
      )
      .collect()

    for (const folder of folders) {
      await deleteFolder(ctx, folder._id)
    }

    const notes = await ctx.db
      .query('notes')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId).eq('parentId', undefined),
      )
      .collect()

    for (const note of notes) {
      await deleteNote(ctx, note._id)
    }

    const maps = await ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId).eq('parentId', undefined),
      )
      .collect()

    for (const map of maps) {
      await deleteMap(ctx, map._id, args.campaignId)
    }

    const files = await ctx.db
      .query('files')
      .withIndex('by_campaign_parent_name', (q) =>
        q.eq('campaignId', args.campaignId).eq('parentId', undefined),
      )
      .collect()

    for (const file of files) {
      await deleteFile(ctx, file._id, args.campaignId)
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
      .withIndex('by_campaign_user', (q) => q.eq('campaignId', args.campaignId))
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
    if (!member || member.campaignId !== ctx.campaign._id) {
      throw new Error('Member not found')
    }

    if (member.role !== CAMPAIGN_MEMBER_ROLE.Player) {
      throw new Error('Only player membership status can be changed')
    }

    const now = Date.now()
    await ctx.db.patch(member._id, { status: args.status, updatedAt: now })

    return member._id
  },
})
