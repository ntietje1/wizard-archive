import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SHARE_STATUS } from '../../blockShares/types'
import { checkItemAccess } from '../../sidebarItems/validation'
import { requireDmRole } from '../../functions'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { Block } from '../types'
import type { BlockShare, ShareStatus } from '../../blockShares/types'
import type { CampaignMember } from '../../campaigns/types'

export const getBlockWithShares = async (
  ctx: AuthQueryCtx,
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
  if (!note) throw new Error('Note not found')
  await requireDmRole(ctx, note.campaignId)
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

  const shareStatus: ShareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  const allMembers = await getCampaignMembers(ctx, {
    campaignId: note.campaignId,
  })
  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  let shares: Array<BlockShare> = []
  if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
    shares = await getBlockSharesByBlock(ctx, { block })
  }

  return {
    block,
    shareStatus,
    shares,
    playerMembers,
  }
}
