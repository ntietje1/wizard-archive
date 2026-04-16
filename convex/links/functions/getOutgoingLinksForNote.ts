import type { CampaignQueryCtx } from '../../functions'
import type { Id, Doc } from '../../_generated/dataModel'

export async function getOutgoingLinksForNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<Doc<'noteLinks'>>> {
  return await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_source', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('sourceNoteId', noteId),
    )
    .collect()
}
