import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { paginationOptsValidator } from 'convex/server'
import { campaignQuery } from '../functions'
import { requireItemAccess } from '../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../permissions/types'
import { getSidebarItem } from '../sidebarItems/functions/getSidebarItem'

const historyEntryValidator = v.object({
  _id: v.id('editHistory'),
  _creationTime: v.number(),
  itemId: v.id('sidebarItems'),
  itemType: v.string(),
  campaignId: v.id('campaigns'),
  campaignMemberId: v.id('campaignMembers'),
  action: v.string(),
  metadata: v.nullable(v.record(v.string(), v.any())),
  hasSnapshot: v.boolean(),
})

export const getHistoryEntry = campaignQuery({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.nullable(historyEntryValidator),
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

export const getItemHistory = campaignQuery({
  args: {
    itemId: v.id('sidebarItems'),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(historyEntryValidator),
    isDone: v.boolean(),
    continueCursor: v.string(),
    splitCursor: v.optional(v.nullable(v.string())),
    pageStatus: v.optional(v.nullable(literals('SplitRecommended', 'SplitRequired'))),
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
