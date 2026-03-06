import { SORT_DIRECTIONS, SORT_ORDERS } from '../types'
import { requireCampaignMembership } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'
import type { SortDirection, SortOrder } from '../types'

export async function setCurrentEditor(
  ctx: AuthMutationCtx,
  {
    sortOrder,
    sortDirection,
    sidebarWidth,
    isSidebarExpanded,
    campaignId,
  }: {
    sortOrder?: SortOrder
    sortDirection?: SortDirection
    sidebarWidth?: number
    isSidebarExpanded?: boolean
    campaignId: Id<'campaigns'>
  },
): Promise<Id<'editor'>> {
  await requireCampaignMembership(ctx, campaignId)
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
      updatedTime: now,
      updatedBy: ctx.user.profile._id,
      createdBy: ctx.user.profile._id,
    })
  }

  await ctx.db.patch(editor._id, {
    ...(sortOrder !== undefined && { sortOrder }),
    ...(sortDirection !== undefined && { sortDirection }),
    ...(sidebarWidth !== undefined && { sidebarWidth }),
    ...(isSidebarExpanded !== undefined && { isSidebarExpanded }),
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })

  return editor._id
}
