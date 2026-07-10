import { DEFAULT_SORT_OPTIONS } from '@wizard-archive/editor/resources/items-persistence-contract'
import type {
  SortDirection,
  SortOrder,
} from '@wizard-archive/editor/resources/items-persistence-contract'
import { WORKSPACE_MODE } from '../../../shared/workspace/workspace-mode'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { WorkspaceMode } from '../../../shared/workspace/workspace-mode'

export async function setCurrentEditor(
  ctx: CampaignMutationCtx,
  {
    sortOrder,
    sortDirection,
    editorMode,
  }: {
    sortOrder?: SortOrder
    sortDirection?: SortDirection
    editorMode?: WorkspaceMode
  },
): Promise<Id<'editor'>> {
  const campaignId = ctx.campaign._id
  const userId = ctx.membership.userId
  const editor = await ctx.db
    .query('editor')
    .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId).eq('userId', userId))
    .unique()

  if (!editor) {
    return await ctx.db.insert('editor', {
      userId,
      campaignId,
      sortOrder: sortOrder ?? DEFAULT_SORT_OPTIONS.order,
      sortDirection: sortDirection ?? DEFAULT_SORT_OPTIONS.direction,
      editorMode: editorMode ?? WORKSPACE_MODE.EDITOR,
    })
  }

  await ctx.db.patch('editor', editor._id, {
    ...(sortOrder !== undefined && { sortOrder }),
    ...(sortDirection !== undefined && { sortDirection }),
    ...(editorMode !== undefined && { editorMode }),
  })

  return editor._id
}
