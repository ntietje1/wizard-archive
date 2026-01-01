import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { findUniqueSlug, shortenId } from '../common/slug'
import {
  getSidebarItemById,
  isValidSidebarParent,
} from '../sidebarItems/sidebarItems'
import { sidebarItemIdValidator } from '../sidebarItems/baseFields'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
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
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    const now = Date.now()
    const updates: Partial<Doc<'folders'>> = {
      updatedAt: now,
    }

    if (args.name !== undefined) {
      updates.name = args.name

      const slugBasis =
        args.name && args.name.trim() !== ''
          ? args.name
          : shortenId(args.folderId)

      const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
        const conflict = await ctx.db
          .query('folders')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', folder.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null && conflict._id !== args.folderId
      })

      updates.slug = uniqueSlug
    }

    await ctx.db.patch(args.folderId, updates)
    return { folderId: args.folderId, slug: updates.slug || folder.slug }
  },
})

export const moveFolder = mutation({
  args: {
    folderId: v.id('folders'),
    parentId: v.optional(sidebarItemIdValidator),
    categoryId: v.optional(v.id('tagCategories')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        folder.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.folders, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }

    await ctx.db.patch(args.folderId, {
      parentId: args.parentId,
      categoryId: args.categoryId,
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
    categoryId: v.optional(v.id('tagCategories')),
    parentId: v.optional(sidebarItemIdValidator),
    campaignId: v.id('campaigns'),
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
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.folders, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }

    const slugBasis =
      args.name && args.name.trim() !== '' ? args.name : crypto.randomUUID()

    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('folders')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', args.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    })

    const folderId = await ctx.db.insert('folders', {
      name: args.name || '',
      slug: uniqueSlug,
      parentId: args.parentId,
      categoryId: args.categoryId,
      updatedAt: Date.now(),
      campaignId: args.campaignId,
      type: 'folders',
    })

    return { folderId, slug: uniqueSlug }
  },
})
