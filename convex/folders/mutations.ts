import { v } from 'convex/values'
import { campaignMutation, dmMutation } from '../functions'
import {
  findNewSidebarItemSlug,
  requireItemAccess,
  validateCreateParent,
  validateMove,
  validateRename,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { PERMISSION_LEVEL } from '../shares/types'
import { deleteFolder as deleteFolderFn } from './folders'
import type { Doc, Id } from '../_generated/dataModel'

export const updateFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
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
    const folder = await requireItemAccess(
      ctx,
      rawFolder,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    const updates: Partial<Doc<'folders'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      updates.slug = await validateRename(ctx, folder, args.name)
    }

    await ctx.db.patch(args.folderId, updates)
    return { folderId: args.folderId, slug: updates.slug || folder.slug }
  },
})

export const moveFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    const rawFolder = await ctx.db.get(args.folderId)
    const folder = await requireItemAccess(
      ctx,
      rawFolder,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    await validateMove(ctx, folder, args.parentId)

    await ctx.db.patch(args.folderId, {
      parentId: args.parentId,
    })
    return args.folderId
  },
})

export const deleteFolder = dmMutation({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
  },
  returns: v.id('folders'),
  handler: async (ctx, args): Promise<Id<'folders'>> => {
    return await deleteFolderFn(ctx, args.folderId)
  },
})

export const createFolder = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.optional(v.string()),
    parentId: v.optional(v.id('folders')),
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
    const campaignId = ctx.campaign._id

    await validateCreateParent(ctx, args.parentId)

    const uniqueSlug = await findNewSidebarItemSlug(
      ctx,
      SIDEBAR_ITEM_TYPES.folders,
      args.name,
    )

    await validateSidebarItemName({
      ctx,
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
      campaignId,
      type: SIDEBAR_ITEM_TYPES.folders,
    })

    return { folderId, slug: uniqueSlug }
  },
})
