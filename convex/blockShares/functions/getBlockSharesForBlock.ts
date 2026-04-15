import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignQueryCtx, DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockShare } from '../types'

export async function getBlockSharesDm(
  ctx: DmQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  const block = await ctx.db.get('blocks', blockId)
  if (!block) throwClientError(ERROR_CODE.NOT_FOUND, 'This content could not be found')
  return await getBlockSharesByBlock(ctx, { block })
}

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
