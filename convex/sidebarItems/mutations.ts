import { v } from 'convex/values'
import { mutation } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { sidebarItemIdValidator } from './baseFields'
import { SIDEBAR_ITEM_TYPES } from './types'
import type { Id } from '../_generated/dataModel'

export const updateSidebarItem = mutation({
  args: {
    itemId: sidebarItemIdValidator,
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new Error('Item not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: item.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
    const patch: {
      name?: string
      iconName?: string | undefined
      color?: string | undefined
      updatedAt: number
    } = {
      updatedAt: Date.now(),
    }

    if (args.name !== undefined) {
      patch.name = args.name
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

    return null
  },
})
