import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { sidebarItemIdValidator } from './schema/baseValidators'
import { updateSidebarItem as updateSidebarItemFn } from './functions/updateSidebarItem'

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
