import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharesForBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SHARE_STATUS } from '../../blockShares/types'
import { checkItemAccess } from '../../sidebarItems/validation'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import type { ShareStatus } from '../../blockShares/types'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../campaigns/types'
import type { BlockShareInfo } from '../types'

export const getBlocksWithShares = async (
  ctx: CampaignQueryCtx,
  {
    noteId,
    blockIds,
  }: {
    noteId: Id<'notes'>
    blockIds: Array<string>
  },
): Promise<{
  blocks: Array<BlockShareInfo>
  playerMembers: Array<CampaignMember>
}> => {
  const note = await ctx.db.get(noteId)
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const blocks: Array<BlockShareInfo> = []

  for (const blockId of blockIds) {
    const block = await findBlockByBlockNoteId(ctx, {
      noteId,
      blockId,
    })

    if (!block) {
      blocks.push({
        blockNoteId: blockId,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedMemberIds: [],
        isTopLevel: true,
      })
      continue
    }

    const shareStatus: ShareStatus =
      block.shareStatus ?? SHARE_STATUS.NOT_SHARED

    let sharedMemberIds: Array<Id<'campaignMembers'>> = []
    if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
      const shares = await getBlockSharesForBlock(ctx, { blockId: block._id })
      sharedMemberIds = shares.map((s) => s.campaignMemberId)
    }

    blocks.push({
      blockNoteId: blockId,
      shareStatus,
      sharedMemberIds,
      isTopLevel: block.isTopLevel,
    })
  }

  return {
    blocks,
    playerMembers,
  }
}
