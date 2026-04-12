import { ERROR_CODE, throwClientError } from '../../errors'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export async function getAllBlocksByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<Block>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')

  return await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note', (q) => q.eq('campaignId', note.campaignId).eq('noteId', noteId))
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .collect()
}
