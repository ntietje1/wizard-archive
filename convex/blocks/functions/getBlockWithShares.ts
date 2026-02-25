import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharesForBlock } from '../../shares/blockShares'
import { PERMISSION_LEVEL, SHARE_STATUS } from '../../shares/types'
import { checkItemAccess } from '../../sidebarItems/validation'
import { findBlockByBlockNoteId } from '../blocks'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Block } from '../types'
import type { BlockShare, ShareStatus } from '../../shares/types'
import type { CampaignMember } from '../../campaigns/types'

export const getBlockWithShares = async (
  ctx: CampaignQueryCtx,
  {
    noteId,
    blockId,
  }: {
    noteId: Id<'notes'>
    blockId: string
  },
): Promise<{
  block: Block
  shareStatus: ShareStatus
  shares: Array<BlockShare>
  playerMembers: Array<CampaignMember>
} | null> => {
  const note = await ctx.db.get(noteId)
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const block = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockId,
  })
  if (!block) {
    return null
  }

  const shareStatus: ShareStatus =
    block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  let shares: Array<BlockShare> = []
  if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
    shares = await getBlockSharesForBlock(ctx, { blockId: block._id })
  }

  return {
    block,
    shareStatus,
    shares,
    playerMembers,
  }
}
