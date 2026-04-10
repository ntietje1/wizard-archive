import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { authQuery } from '../functions'
import { sidebarItemIdValidator } from '../sidebarItems/schema/baseValidators'
import { requireItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../permissions/types'
import { getSidebarItem } from '../sidebarItems/functions/getSidebarItem'

const historyEntryValidator = v.object({
  _id: v.id('editHistory'),
  _creationTime: v.number(),
  itemId: sidebarItemIdValidator,
  itemType: v.string(),
  campaignId: v.id('campaigns'),
  campaignMemberId: v.id('campaignMembers'),
  action: v.string(),
  metadata: v.union(v.record(v.string(), v.any()), v.null()),
  hasSnapshot: v.boolean(),
})

export const getHistoryEntry = authQuery({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.union(historyEntryValidator, v.null()),
  handler: async (ctx, { editHistoryId }) => {
    const entry = await ctx.db.get('editHistory', editHistoryId)
    if (!entry) return null

    const item = await getSidebarItem(ctx, entry.itemId)
    await requireItemAccess(ctx, {
      rawItem: item,
      requiredLevel: PERMISSION_LEVEL.VIEW,
    })

    return entry
  },
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
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(v.literal('SplitRecommended'), v.literal('SplitRequired'), v.null()),
    ),
  }),
  handler: async (ctx, { itemId, paginationOpts }) => {
    const itemFromDb = await getSidebarItem(ctx, itemId)
    await requireItemAccess(ctx, {
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
