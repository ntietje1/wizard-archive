import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { campaignQuery } from '../functions'
import { requireItemAccess } from '../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import { getSidebarItem } from '../sidebarItems/functions/getSidebarItem'
import { paginatedQueryResultFields } from '../common/pagination'
import { editHistoryValidator, historyEntryIdValidator } from './schema'
import { getHistoryEntryRow, requireHistoryEntryId } from './functions/getHistoryEntry'
import type { Doc } from '../_generated/dataModel'

function toEditHistoryEntry(entry: Doc<'editHistory'>) {
  const { _id: _rowId, _creationTime, historyEntryUuid, ...fields } = entry
  return { ...fields, id: historyEntryUuid, createdAt: _creationTime }
}

export const getHistoryEntry = campaignQuery({
  args: {
    editHistoryId: historyEntryIdValidator,
  },
  returns: v.nullable(editHistoryValidator),
  handler: async (ctx, { editHistoryId }) => {
    const entry = await getHistoryEntryRow(ctx, requireHistoryEntryId(editHistoryId))
    if (!entry) return null

    const item = await getSidebarItem(ctx, entry.itemId)
    await requireItemAccess(ctx, {
      rawItem: item,
      requiredLevel: PERMISSION_LEVEL.EDIT,
    })

    return toEditHistoryEntry(entry)
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
    const page = await ctx.db
      .query('editHistory')
      .withIndex('by_item', (q) => q.eq('itemId', itemId))
      .order('desc')
      .paginate(paginationOpts)
    return { ...page, page: page.page.map(toEditHistoryEntry) }
  },
})
