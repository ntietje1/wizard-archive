import { SORT_DIRECTIONS, SORT_ORDERS } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { SortDirection, SortOrder } from '../types'

export async function setCurrentEditor(
  ctx: CampaignMutationCtx,
  {
    sortOrder,
    sortDirection,
    sidebarWidth,
    isSidebarExpanded,
  }: {
    sortOrder?: SortOrder
    sortDirection?: SortDirection
    sidebarWidth?: number
    isSidebarExpanded?: boolean
  },
): Promise<Id<'editor'>> {
  const campaignId = ctx.campaign._id
  const now = Date.now()

  const editor = await ctx.db
    .query('editor')
    .withIndex('by_campaign_user', (q) =>
      q.eq('campaignId', campaignId).eq('userId', ctx.user.profile._id),
    )
    .unique()

  if (!editor) {
    return await ctx.db.insert('editor', {
      userId: ctx.user.profile._id,
      campaignId,
      sortOrder: sortOrder ?? SORT_ORDERS.DateCreated,
      sortDirection: sortDirection ?? SORT_DIRECTIONS.Ascending,
      sidebarWidth,
      isSidebarExpanded,
      _updatedTime: now,
      _updatedBy: ctx.user.profile._id,
      _createdBy: ctx.user.profile._id,
    })
  }

  await ctx.db.patch(editor._id, {
    ...(sortOrder !== undefined && { sortOrder }),
    ...(sortDirection !== undefined && { sortDirection }),
    ...(sidebarWidth !== undefined && { sidebarWidth }),
    ...(isSidebarExpanded !== undefined && { isSidebarExpanded }),
    _updatedTime: now,
    _updatedBy: ctx.user.profile._id,
  })

  return editor._id
}
