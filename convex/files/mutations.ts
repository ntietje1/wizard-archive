import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  requireItemAccess,
  validateCreateParent,
  validateMove,
  validateRename,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import { PERMISSION_LEVEL } from '../shares/types'
import { findUniqueSlug, resolveSlugBasis } from '../common/slug'
import { deleteFile as deleteFileHelper } from './files'
import type { Doc, Id } from '../_generated/dataModel'

export const moveFile = campaignMutation({
  args: {
    fileId: v.id('files'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    const rawFile = await ctx.db.get(args.fileId)
    const file = await requireItemAccess(
      ctx,
      args.campaignId,
      rawFile,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    await validateMove(ctx, file, args.parentId)

    await ctx.db.patch(args.fileId, {
      parentId: args.parentId,
      updatedAt: Date.now(),
    })
    return args.fileId
  },
})

export const createFile = campaignMutation({
  args: {
    name: v.optional(v.string()),
    storageId: v.optional(v.id('_storage')),
    parentId: v.optional(v.id('folders')),
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
    await validateCreateParent(ctx, args.campaignId, args.parentId)

    await validateSidebarItemName({
      ctx,
      campaignId: args.campaignId,
      parentId: args.parentId,
      name: args.name,
    })

    const uniqueSlug = await findUniqueSlug(
      resolveSlugBasis(args.name),
      async (slug) => {
        const conflict = await ctx.db
          .query('files')
          .withIndex('by_campaign_slug', (q) =>
            q.eq('campaignId', args.campaignId).eq('slug', slug),
          )
          .unique()
        return conflict !== null
      },
    )

    const fileId = await ctx.db.insert('files', {
      campaignId: args.campaignId,
      name: args.name,
      slug: uniqueSlug,
      iconName: args.iconName,
      color: args.color,
      storageId: args.storageId,
      parentId: args.parentId,
      updatedAt: Date.now(),
      type: SIDEBAR_ITEM_TYPES.files,
    })

    return { fileId, slug: uniqueSlug }
  },
})

export const updateFile = campaignMutation({
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
    const file = await requireItemAccess(
      ctx,
      args.campaignId,
      rawFile,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    const updates: Partial<Doc<'files'>> = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      updates.name = args.name
      updates.slug = await validateRename(ctx, args.campaignId, file, args.name)
    }
    if (args.storageId !== undefined) {
      updates.storageId = args.storageId
    }
    if (args.iconName !== undefined) {
      updates.iconName = args.iconName
    }
    if (args.color !== undefined) {
      updates.color = args.color
    }
    await ctx.db.patch(args.fileId, updates)
    return { fileId: args.fileId, slug: updates.slug || file.slug }
  },
})

export const deleteFile = campaignMutation({
  args: {
    fileId: v.id('files'),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    const rawFile = await ctx.db.get(args.fileId)
    await requireItemAccess(
      ctx,
      args.campaignId,
      rawFile,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

    await deleteFileHelper(ctx, args.fileId, args.campaignId)
    return args.fileId
  },
})
