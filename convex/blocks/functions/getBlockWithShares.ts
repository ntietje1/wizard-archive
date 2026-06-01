import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'
import type { Block } from '../types'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { BlockShare } from '../../blockShares/types'
import type { CampaignMember } from '../../campaigns/types'

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
  const note = await getSidebarItem(ctx, noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
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

  const allMembers = await getCampaignMembers(ctx)
  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)

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
