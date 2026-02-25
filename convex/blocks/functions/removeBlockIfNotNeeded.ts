import { SHARE_STATUS } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

/**
 * Removes a block if:
 * - It is not shared
 * - It is not a top-level block
 */
export async function removeBlockIfNotNeeded(
  ctx: CampaignMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const block = await ctx.db.get(blockId)
  if (
    !block ||
    block.campaignId !== campaignId ||
    block.isTopLevel ||
    block.shareStatus !== SHARE_STATUS.NOT_SHARED
  ) {
    return
  }
  await ctx.db.delete(blockId)
}
