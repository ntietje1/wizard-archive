import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import {
  getSidebarItemById,
  validateUniqueNameUnderParent,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { findUniqueSlug, shortenId } from '../common/slug'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import { deleteFile as deleteFileFn } from './files'
import type { Doc, Id } from '../_generated/dataModel'

export const moveFile = mutation({
  args: {
    fileId: v.id('files'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    const file = await ctx.db.get(args.fileId)
    if (!file) {
      throw new Error('File not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: file.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        file.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }

    await validateUniqueNameUnderParent(
      ctx,
      file.campaignId,
      args.parentId,
      file.name,
      file._id,
    )

    await ctx.db.patch(args.fileId, {
      parentId: args.parentId,
      updatedAt: Date.now(),
    })
    return args.fileId
  },
})

export const createFile = mutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    storageId: v.id('_storage'),
    parentId: v.optional(sidebarItemIdValidator),
  },
  returns: v.object({
    fileId: v.id('files'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileId: Id<'files'>; slug: string }> => {
    await requireCampaignMembership(
      ctx,
      { campaignId: args.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        args.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }

    await validateUniqueNameUnderParent(
      ctx,
      args.campaignId,
      args.parentId,
      args.name,
    )

    const slugBasis =
      args.name && args.name.trim() !== '' ? args.name : crypto.randomUUID()

    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('files')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', args.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    const fileId = await ctx.db.insert('files', {
      campaignId: args.campaignId,
      name: args.name,
      slug: uniqueSlug,
      storageId: args.storageId,
      parentId: args.parentId,
      updatedAt: Date.now(),
      type: SIDEBAR_ITEM_TYPES.files,
    })
    return { fileId, slug: uniqueSlug }
  },
})

export const updateFile = mutation({
  args: {
    fileId: v.id('files'),
    name: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    fileId: v.id('files'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileId: Id<'files'>; slug: string }> => {
    const file = await ctx.db.get(args.fileId)
    if (!file) {
      throw new Error('File not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: file.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const updates: Partial<Doc<'files'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateUniqueNameUnderParent(
        ctx,
        file.campaignId,
        file.parentId,
        args.name,
        file._id,
      )

      const slugBasis =
        args.name && args.name.trim() !== ''
          ? args.name
          : shortenId(args.fileId)

      const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('files')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', file.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== args.fileId
      })

      updates.slug = uniqueSlug
    }
    if (args.storageId !== undefined) {
      updates.storageId = args.storageId
    }
    if (args.iconName !== undefined) {
      updates.iconName = args.iconName ?? undefined
    }
    if (args.color !== undefined) {
      updates.color = args.color ?? undefined
    }
    await ctx.db.patch(args.fileId, updates)
    return { fileId: args.fileId, slug: updates.slug || file.slug }
  },
})

export const deleteFile = mutation({
  args: {
    fileId: v.id('files'),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    return await deleteFileFn(ctx, args.fileId)
  },
})
