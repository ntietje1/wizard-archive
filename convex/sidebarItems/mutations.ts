import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { sidebarItemIdValidator } from './schema/baseValidators'
import { requireItemAccess, validateRename } from './validation'
import { PERMISSION_LEVEL } from '../shares/types'
import { SIDEBAR_ITEM_TYPES } from './baseTypes'
import type { Id } from '../_generated/dataModel'
import type { AnySidebarItemFromDb } from './types'

export const updateSidebarItem = campaignMutation({
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
    const item = await requireItemAccess(
      ctx,
      args.campaignId,
      rawItem as AnySidebarItemFromDb | null,
      PERMISSION_LEVEL.FULL_ACCESS,
    )

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
      patch.name = args.name
      patch.slug = await validateRename(
        ctx,
        args.campaignId,
        item,
        args.name,
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
