import { SHARE_STATUS } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'

export async function removeBlockIfNotNeeded(
  ctx: CampaignMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get('blocks', blockId)
  if (
    !block ||
    block.isTopLevel ||
    block.shareStatus !== SHARE_STATUS.NOT_SHARED ||
    block.deletionTime
  ) {
    return
  }
  const now = Date.now()
  await ctx.db.patch('blocks', blockId, {
    deletionTime: now,
    deletedBy: ctx.membership.userId,
    updatedTime: now,
    updatedBy: ctx.membership.userId,
  })
}
