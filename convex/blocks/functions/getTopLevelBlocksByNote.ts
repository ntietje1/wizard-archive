import type { Block } from '../types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export async function getTopLevelBlocksByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'notes'> },
): Promise<Array<Block>> {
  const campaignId = ctx.campaign._id

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_topLevel', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('noteId', noteId)
        .eq('isTopLevel', true),
    )
    .collect()

  return blocks.sort((a, b) => (a.position || 0) - (b.position || 0))
}
