import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { findUniqueFolderSlug, findUniqueSlug, resolveSlugBasis } from '../common/slug'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import {
  validateParentChange,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  requireEditPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { deleteFolder as deleteFolderFn } from './folders'
import type { Doc, Id } from '../_generated/dataModel'

export const updateFolder = mutation({
  args: {
    folderId: v.id('folders'),
    name: v.optional(v.string()),
  },
  returns: v.object({
    folderId: v.id('folders'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: Id<'folders'>; slug: string }> => {
    const rawFolder = await ctx.db.get(args.folderId)
    if (!rawFolder) {
      throw new Error('Folder not found')
    }

    const folder = await enhanceSidebarItem(ctx, rawFolder)
    await requireFullAccessPermission(ctx, folder)

    const now = Date.now()
    const updates: Partial<Doc<'folders'>> = {
      updatedAt: now,
    }

    if (args.name !== undefined) {
      updates.name = args.name
      await validateSidebarItemName({
        ctx,
        campaignId: folder.campaignId,
        parentId: folder.parentId,
        name: args.name,
        excludeId: folder._id,
      })

      updates.slug = await findUniqueFolderSlug(
        ctx,
        folder.campaignId,
        args.name,
        args.folderId,
      )
    }

    await ctx.db.patch(args.folderId, updates)
    return { folderId: args.folderId, slug: updates.slug || folder.slug }
  },
})

export const moveFolder = mutation({
  args: {
    folderId: v.id('folders'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const rawFolder = await ctx.db.get(args.folderId)
    if (!rawFolder) {
      throw new Error('Folder not found')
    }

    const folder = await enhanceSidebarItem(ctx, rawFolder)
    await requireFullAccessPermission(ctx, folder)

    // Validate no circular parent reference
    await validateParentChange({
      ctx,
      item: folder,
      newParentId: args.parentId,
    })

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        folder.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
    }

    // Validate name doesn't conflict in new location
    await validateSidebarItemName({
      ctx,
      campaignId: folder.campaignId,
      parentId: args.parentId,
      name: folder.name,
      excludeId: folder._id,
    })

    await ctx.db.patch(args.folderId, {
      parentId: args.parentId,
    })
    return args.folderId
  },
})

export const deleteFolder = mutation({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    return await deleteFolderFn(ctx, args.folderId)
  },
})

export const createFolder = mutation({
  args: {
    name: v.optional(v.string()),
    parentId: v.optional(v.id('folders')),
    campaignId: v.id('campaigns'),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    folderId: v.id('folders'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderId: Id<'folders'>; slug: string }> => {
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

    const uniqueSlug = await findUniqueSlug(resolveSlugBasis(args.name), async (slug) => {
      const conflict = await ctx.db
        .query('folders')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', args.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

    const folderId = await ctx.db.insert('folders', {
      name: args.name || '',
      slug: uniqueSlug,
      iconName: args.iconName,
      color: args.color,
      parentId: args.parentId,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
      type: SIDEBAR_ITEM_TYPES.folders,
    })

    return { folderId, slug: uniqueSlug }
  },
})
