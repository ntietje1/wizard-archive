import { ERROR_CODE, throwClientError } from '../../errors'
import type { Block, BlockNoteId } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export const findBlockByBlockNoteId = async (
  ctx: CampaignQueryCtx,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: BlockNoteId },
): Promise<Block | null> => {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId).eq('blockNoteId', blockNoteId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .first()

  return block
}
