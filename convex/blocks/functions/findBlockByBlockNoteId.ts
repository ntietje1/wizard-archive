import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { NoteBlockId } from '@wizard-archive/editor/notes/document-contract'
import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

export const findBlockByBlockNoteId = async (
  ctx: Pick<QueryCtx, 'db'>,
  { noteId, blockNoteId }: { noteId: Id<'sidebarItems'>; blockNoteId: NoteBlockId },
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
    .first()

  return block
}
