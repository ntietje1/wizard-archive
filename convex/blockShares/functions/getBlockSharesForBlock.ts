import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockShare } from '../types'

export async function getBlockSharesByBlock(
  ctx: CampaignQueryCtx,
  { block }: { block: { _id: Id<'blocks'>; campaignId: Id<'campaigns'> } },
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .collect()
}
