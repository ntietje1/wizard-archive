import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { campaignQuery } from '../functions'
import { requireItemAccess } from '../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getSidebarItem } from '../sidebarItems/functions/getSidebarItem'
import { paginatedQueryResultFields } from '../common/pagination'
import { editHistoryValidator } from './schema'

export const getHistoryEntry = campaignQuery({
  args: {
    editHistoryId: v.id('editHistory'),
  },
  returns: v.nullable(editHistoryValidator),
  handler: async (ctx, { editHistoryId }) => {
    const entry = await ctx.db.get('editHistory', editHistoryId)
    if (!entry) return null

    const item = await getSidebarItem(ctx, entry.itemId)
    await requireItemAccess(ctx, {
      rawItem: item,
      requiredLevel: PERMISSION_LEVEL.EDIT,
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
    page: v.array(editHistoryValidator),
    ...paginatedQueryResultFields,
  }),
  handler: async (ctx, { itemId, paginationOpts }) => {
    const itemRow = await getSidebarItem(ctx, itemId)
    await requireItemAccess(ctx, {
      rawItem: itemRow,
      requiredLevel: PERMISSION_LEVEL.EDIT,
    })
    return await ctx.db
      .query('editHistory')
      .withIndex('by_item', (q) => q.eq('itemId', itemId))
      .order('desc')
      .paginate(paginationOpts)
  },
})
