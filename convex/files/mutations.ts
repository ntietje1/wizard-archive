import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import {
  validateParentChange,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { findUniqueFileSlug, findUniqueSlug } from '../common/slug'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  requireEditPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { deleteFile as deleteFileFn } from './files'
import type { Doc, Id } from '../_generated/dataModel'

export const moveFile = mutation({
  args: {
    fileId: v.id('files'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    const rawFile = await ctx.db.get(args.fileId)
    if (!rawFile) {
      throw new Error('File not found')
    }

    const file = await enhanceSidebarItem(ctx, rawFile)
    await requireFullAccessPermission(ctx, file)

    // Validate no circular parent reference
    await validateParentChange({
      ctx,
      item: file,
      newParentId: args.parentId,
    })

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

    // Validate name doesn't conflict in new location
    await validateSidebarItemName({
      ctx,
      campaignId: file.campaignId,
      parentId: args.parentId,
      name: file.name,
      excludeId: file._id,
    })

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
    storageId: v.optional(v.id('_storage')),
    parentId: v.optional(v.id('folders')),
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

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

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
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    fileId: v.id('files'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ fileId: Id<'files'>; slug: string }> => {
    const rawFile = await ctx.db.get(args.fileId)
    if (!rawFile) {
      throw new Error('File not found')
    }

    const file = await enhanceSidebarItem(ctx, rawFile)
    await requireFullAccessPermission(ctx, file)

    const updates: Partial<Doc<'files'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateSidebarItemName({
        ctx,
        campaignId: file.campaignId,
        parentId: file.parentId,
        name: args.name,
        excludeId: file._id,
      })

      updates.slug = await findUniqueFileSlug(
        ctx,
        file.campaignId,
        args.name,
        args.fileId,
      )
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
