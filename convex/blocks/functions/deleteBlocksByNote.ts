import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function deleteBlocksByNote(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_block', (q) =>
      q.eq('campaignId', campaignId).eq('noteId', noteId),
    )
    .collect()

  for (const block of blocks) {
    await ctx.db.delete(block._id)
  }
}
