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
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { QueryCtx } from '../_generated/server'

async function toEditHistoryEntry(
  ctx: Pick<QueryCtx, 'db'>,
  campaign: Pick<Doc<'campaigns'>, '_id' | 'campaignUuid'>,
  entry: Doc<'editHistory'>,
) {
  if (entry.campaignId !== campaign._id) {
    throw new Error('Edit history entry is outside its campaign')
  }
  const member = await ctx.db.get('campaignMembers', entry.campaignMemberId)
  if (!member || member.campaignId !== entry.campaignId) {
    throw new Error('Edit history member is missing from its campaign')
  }

  const {
    _id: _rowId,
    _creationTime,
    historyEntryUuid,
    campaignId: _campaignRowId,
    campaignMemberId: _campaignMemberRowId,
    ...fields
  } = entry
  return {
    ...fields,
    id: historyEntryUuid,
    createdAt: _creationTime,
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, campaign.campaignUuid),
    campaignMemberId: assertDomainId(DOMAIN_ID_KIND.campaignMember, member.campaignMemberUuid),
  }
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

    return await toEditHistoryEntry(ctx, ctx.campaign, entry)
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
    return {
      ...page,
      page: await Promise.all(
        page.page.map((entry) => toEditHistoryEntry(ctx, ctx.campaign, entry)),
      ),
    }
  },
})
