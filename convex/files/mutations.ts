import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import {
  validateParentChange,
  validateSidebarItemName,
} from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import {
  findUniqueFileSlug,
  findUniqueSlug,
  resolveSlugBasis,
} from '../common/slug'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { requireFullAccessPermission } from '../shares/itemShares'
import type { Doc, Id } from '../_generated/dataModel'

export const moveFile = campaignMutation({
  args: {
    fileId: v.id('files'),
    parentId: v.optional(v.id('folders')),
  },
  returns: v.id('files'),
  handler: async (ctx, args): Promise<Id<'files'>> => {
    const rawFile = await ctx.db.get(args.fileId)
    if (!rawFile || rawFile.campaignId !== args.campaignId) {
      throw new Error('File not found')
    }

    const file = await enhanceSidebarItem(ctx, rawFile)
    await requireFullAccessPermission(ctx, file)

    await validateParentChange({
      ctx,
      item: file,
      newParentId: args.parentId,
    })

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
    if (args.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        args.campaignId,
        args.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      await requireFullAccessPermission(ctx, parentItem)
    } else {
      if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
        throw new Error('Only the DM can create items at the root level')
      }
    }

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
    if (!rawFile || rawFile.campaignId !== args.campaignId) {
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
        campaignId: args.campaignId,
        parentId: file.parentId,
        name: args.name,
        excludeId: file._id,
      })

      updates.slug = await findUniqueFileSlug(
        ctx,
        args.campaignId,
        args.name,
        args.fileId,
      )
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
    if (!rawFile || rawFile.campaignId !== args.campaignId) {
      throw new Error('File not found')
    }

    const file = await enhanceSidebarItem(ctx, rawFile)
    await requireFullAccessPermission(ctx, file)

    if (rawFile.storageId) {
      await ctx.storage.delete(rawFile.storageId)
    }

    await ctx.db.delete(args.fileId)
    return args.fileId
  },
})
