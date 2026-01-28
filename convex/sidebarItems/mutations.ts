import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { findUniqueSidebarItemSlug } from '../common/slug'
import { requireEditPermission } from '../shares/itemShares'
import { sidebarItemIdValidator } from './schema/baseValidators'
import { validateSidebarItemName } from './validation'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import { enhanceSidebarItem } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { AnySidebarItemFromDb } from './types'

export const updateSidebarItem = mutation({
  args: {
    itemId: sidebarItemIdValidator,
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ slug: string }> => {
    const rawItem = await ctx.db.get(args.itemId)
    if (!rawItem) {
      throw new Error('Item not found')
    }

    const item = await enhanceSidebarItem(ctx, rawItem as AnySidebarItemFromDb)
    await requireEditPermission(ctx, item)

    const patch: {
      name?: string
      slug?: string
      iconName?: string | undefined
      color?: string | undefined
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      await validateSidebarItemName({
        ctx,
        campaignId: item.campaignId,
        parentId: item.parentId,
        name: args.name,
        excludeId: args.itemId,
      })
      patch.name = args.name
      patch.slug = await findUniqueSidebarItemSlug(
        ctx,
        item.campaignId,
        item.type,
        args.name,
        args.itemId,
      )
    }
    if (args.iconName !== undefined) {
      patch.iconName = args.iconName ?? undefined
    }
    if (args.color !== undefined) {
      patch.color = args.color ?? undefined
    }

    switch (item.type) {
      case SIDEBAR_ITEM_TYPES.notes:
        await ctx.db.patch(args.itemId as Id<'notes'>, patch)
        break
      case SIDEBAR_ITEM_TYPES.folders:
        await ctx.db.patch(args.itemId as Id<'folders'>, patch)
        break
      case SIDEBAR_ITEM_TYPES.gameMaps:
        await ctx.db.patch(args.itemId as Id<'gameMaps'>, patch)
        break
      case SIDEBAR_ITEM_TYPES.files:
        await ctx.db.patch(args.itemId as Id<'files'>, patch)
        break
      default:
        throw new Error(`Unknown item type, ${item}`)
    }

    return { slug: patch.slug || item.slug }
  },
})
