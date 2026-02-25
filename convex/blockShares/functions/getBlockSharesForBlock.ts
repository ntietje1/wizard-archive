import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockShare } from '../types'

export async function getBlockSharesForBlock(
  ctx: CampaignQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('blockId', blockId),
    )
    .collect()
}
