import { SHARE_STATUS } from '../../blockShares/types'
import type { Id } from '../../_generated/dataModel'
import type { AuthMutationCtx } from '../../functions'

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
  const now = Date.now()
  await ctx.db.patch(blockId, {
    deletionTime: now,
    deletedBy: ctx.user.profile._id,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
  })
}
