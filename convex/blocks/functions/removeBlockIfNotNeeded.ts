import { SHARE_STATUS } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

/**
 * Removes a block if:
 * - It is not shared
 * - It is not a top-level block
 */
export async function removeBlockIfNotNeeded(
  ctx: AuthMutationCtx,
  { blockId }: { blockId: Id<'blocks'> },
): Promise<void> {
  const block = await ctx.db.get(blockId)
  if (
    !block ||
    block.isTopLevel ||
    block.shareStatus !== SHARE_STATUS.NOT_SHARED
  ) {
    return
  }
  await ctx.db.delete(blockId)
}
