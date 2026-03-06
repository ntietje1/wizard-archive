import { requireCampaignMembership, requireDmRole } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockShare } from '../types'

export async function getBlockSharesDm(
  ctx: AuthQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  const block = await ctx.db.get(blockId)
  if (!block) throw new Error('Block not found')
  await requireDmRole(ctx, block.campaignId)
  return await getBlockSharesForBlock(ctx, { blockId })
}

export async function getBlockSharesForBlock(
  ctx: AuthQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  const block = await ctx.db.get(blockId)
  if (!block) throw new Error('Block not found')
  await requireCampaignMembership(ctx, block.campaignId)

  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', blockId),
    )
    .collect()
}
