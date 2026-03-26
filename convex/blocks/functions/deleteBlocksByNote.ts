import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

export async function deleteBlocksByNote(
  ctx: AuthMutationCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<void> {
  const note = await ctx.db.get(noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId),
    )
    .collect()

  for (const block of blocks) {
    await ctx.db.delete(block._id)
  }
}
