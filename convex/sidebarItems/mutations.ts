import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { sidebarItemIdValidator } from './schema/baseValidators'
import { updateSidebarItem as updateSidebarItemFn } from './functions/updateSidebarItem'
import { moveSidebarItem as moveSidebarItemFn } from './functions/moveSidebarItem'
import type { SidebarItemId } from './types/baseTypes'

export const updateSidebarItem = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    itemId: sidebarItemIdValidator,
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ slug: string }> => {
    return await updateSidebarItemFn(ctx, {
      itemId: args.itemId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const moveSidebarItem = campaignMutation({
  args: {
    campaignId: v.id('campaigns'),
    itemId: sidebarItemIdValidator,
    parentId: v.optional(v.id('folders')),
  },
  returns: sidebarItemIdValidator,
  handler: async (ctx, args): Promise<SidebarItemId> => {
    return await moveSidebarItemFn(ctx, {
      itemId: args.itemId,
      parentId: args.parentId,
    })
  },
})
