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
  return await getBlockSharesByBlock(ctx, { block })
}

export async function getBlockSharesForBlock(
  ctx: AuthQueryCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<Array<BlockShare>> {
  const block = await ctx.db.get(blockId)
  if (!block) throw new Error('Block not found')
  await requireCampaignMembership(ctx, block.campaignId)
  return await getBlockSharesByBlock(ctx, { block })
}

export async function getBlockSharesByBlock(
  ctx: AuthQueryCtx,
  { block }: { block: { _id: Id<'blocks'>; campaignId: Id<'campaigns'> } },
): Promise<Array<BlockShare>> {
  return await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q.eq('campaignId', block.campaignId).eq('blockId', block._id),
    )
    .collect()
}
