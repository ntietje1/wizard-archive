import type { CampaignQueryCtx } from '../../functions'
import type { Id, Doc } from '../../_generated/dataModel'

export async function getBacklinksForItem(
  ctx: CampaignQueryCtx,
  { itemId }: { itemId: Id<'sidebarItems'> },
): Promise<Array<Doc<'noteLinks'>>> {
  return await ctx.db
    .query('noteLinks')
    .withIndex('by_campaign_target', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('targetItemId', itemId),
    )
    .collect()
}
