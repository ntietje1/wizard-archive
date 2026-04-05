import { v } from 'convex/values'
import { authQuery } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'

export const getItemHistory = authQuery({
  args: {
    itemId: sidebarItemIdValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id('editHistory'),
      _creationTime: v.number(),
      itemId: sidebarItemIdValidator,
      itemType: v.string(),
      campaignId: v.id('campaigns'),
      campaignMemberId: v.id('campaignMembers'),
      action: v.string(),
      metadata: v.union(v.record(v.string(), v.any()), v.null()),
    }),
  ),
  handler: async (ctx, { itemId, limit }) => {
    const entries = await ctx.db
      .query('editHistory')
      .withIndex('by_item', (q) => q.eq('itemId', itemId))
      .order('desc')
      .take(limit ?? 50)

    return entries
  },
})
