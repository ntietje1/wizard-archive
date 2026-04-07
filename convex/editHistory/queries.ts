import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { authQuery } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { requireItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../permissions/types'

const historyEntryValidator = v.object({
  _id: v.id('editHistory'),
  _creationTime: v.number(),
  itemId: sidebarItemIdValidator,
  itemType: v.string(),
  campaignId: v.id('campaigns'),
  campaignMemberId: v.id('campaignMembers'),
  action: v.string(),
  metadata: v.union(v.record(v.string(), v.any()), v.null()),
})

export const getItemHistory = authQuery({
  args: {
    itemId: sidebarItemIdValidator,
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(historyEntryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.union(v.string(), v.null()),
    pageStatus: v.union(
      v.literal('SplitRecommended'),
      v.literal('SplitRequired'),
      v.null(),
    ),
  }),
  handler: async (ctx, { itemId, paginationOpts }) => {
    const itemFromDb = await ctx.db.get(itemId)
    requireItemAccess(ctx, {
      rawItem: itemFromDb,
      requiredLevel: PERMISSION_LEVEL.EDIT,
    })
    return await ctx.db
      .query('editHistory')
      .withIndex('by_item', (q) => q.eq('itemId', itemId))
      .order('desc')
      .paginate(paginationOpts)
  },
})
