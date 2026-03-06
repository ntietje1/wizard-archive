import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'
import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'

export const findBlockByBlockNoteId = async (
  ctx: AuthQueryCtx,
  { noteId, blockId }: { noteId: Id<'notes'>; blockId: string },
): Promise<Block | null> => {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }
  await requireCampaignMembership(ctx, note.campaignId)

  const block = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q
        .eq('campaignId', note.campaignId)
        .eq('noteId', noteId)
        .eq('blockId', blockId),
    )
    .unique()

  return block
}
