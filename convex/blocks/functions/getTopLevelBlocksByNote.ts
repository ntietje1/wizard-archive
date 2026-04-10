import { ERROR_CODE, throwClientError } from '../../errors'
import { requireCampaignMembership } from '../../functions'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export async function getTopLevelBlocksByNote(
  ctx: AuthQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<Block>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireCampaignMembership(ctx, note.campaignId)

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_topLevel', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId).eq('isTopLevel', true),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()

  return blocks.sort((a, b) => (a.position || 0) - (b.position || 0))
}
