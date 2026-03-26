import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SHARE_STATUS } from '../../blockShares/types'
import { checkItemAccess } from '../../sidebarItems/validation'
import { requireDmRole } from '../../functions'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import type { ShareStatus } from '../../blockShares/types'
import type { AuthQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../campaigns/types'
import type { BlockShareInfo } from '../types'

export const getBlocksWithShares = async (
  ctx: AuthQueryCtx,
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
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireDmRole(ctx, note.campaignId)
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const allMembers = await getCampaignMembers(ctx, {
    campaignId: note.campaignId,
  })
  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const blocks = await Promise.all(
    blockIds.map(async (blockId): Promise<BlockShareInfo> => {
      const block = await findBlockByBlockNoteId(ctx, { noteId, blockId })

      if (!block) {
        return {
          blockNoteId: blockId,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          sharedMemberIds: [],
          isTopLevel: true,
        }
      }

      const shareStatus: ShareStatus =
        block.shareStatus ?? SHARE_STATUS.NOT_SHARED

      let sharedMemberIds: Array<Id<'campaignMembers'>> = []
      if (shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED) {
        const shares = await getBlockSharesByBlock(ctx, { block })
        sharedMemberIds = shares.map((s) => s.campaignMemberId)
      }

      return {
        blockNoteId: blockId,
        shareStatus,
        sharedMemberIds,
        isTopLevel: block.isTopLevel,
      }
    }),
  )

  return {
    blocks,
    playerMembers,
  }
}
