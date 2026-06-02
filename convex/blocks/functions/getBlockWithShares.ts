import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { getEligibleBlockSharePlayers } from './getEligibleBlockSharePlayers'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'
import type { Block } from '../types'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { BlockShare } from '../../blockShares/types'
import type { CampaignMember } from '../../../shared/campaigns/types'

export const getBlockWithShares = async (
  ctx: DmQueryCtx,
  {
    noteId,
    blockNoteId,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteId: BlockNoteId
  },
): Promise<{
  block: Block
  shareStatus: ShareStatus
  shares: Array<BlockShare>
  playerMembers: Array<CampaignMember>
} | null> => {
  const note = await getSidebarItem<'notes'>(ctx, noteId)
  if (!note || note.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const block = await findBlockByBlockNoteId(ctx, {
    noteId,
    blockNoteId,
  })
  if (!block) {
    return null
  }

  const shareStatus: ShareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  const eligiblePlayers = await getEligibleBlockSharePlayers(ctx, note)

  let shares: Array<BlockShare> = []
  if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
    const blockShares = await getBlockSharesByBlock(ctx, { block })
    shares = blockShares.filter((share) =>
      eligiblePlayers.eligibleMemberIds.has(share.campaignMemberId),
    )
  }

  return {
    block,
    shareStatus,
    shares,
    playerMembers: eligiblePlayers.playerMembers,
  }
}
