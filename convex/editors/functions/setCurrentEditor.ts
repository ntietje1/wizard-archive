import { EDITOR_MODE, SORT_DIRECTIONS, SORT_ORDERS } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { EditorMode, SortDirection, SortOrder } from '../types'

export async function setCurrentEditor(
  ctx: CampaignMutationCtx,
  {
    sortOrder,
    sortDirection,
    editorMode,
  }: {
    sortOrder?: SortOrder
    sortDirection?: SortDirection
    editorMode?: EditorMode
  },
): Promise<Id<'editor'>> {
  const campaignId = ctx.campaign._id
  const userId = ctx.membership.userId
  const now = Date.now()

  const editor = await ctx.db
    .query('editor')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId).eq('userId', userId))
    .unique()

  if (!editor) {
    return await ctx.db.insert('editor', {
      userId,
      campaignId,
      sortOrder: sortOrder ?? SORT_ORDERS.DateCreated,
      sortDirection: sortDirection ?? SORT_DIRECTIONS.Ascending,
      editorMode: editorMode ?? EDITOR_MODE.EDITOR,
      deletionTime: null,
      deletedBy: null,
      updatedTime: null,
      updatedBy: null,
      createdBy: userId,
    })
  }

  await ctx.db.patch('editor', editor._id, {
    ...(sortOrder !== undefined && { sortOrder }),
    ...(sortDirection !== undefined && { sortDirection }),
    ...(editorMode !== undefined && { editorMode }),
    updatedTime: now,
    updatedBy: userId,
  })

  return editor._id
}
