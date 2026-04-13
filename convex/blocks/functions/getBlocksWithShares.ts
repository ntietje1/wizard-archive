import { asyncMap } from 'convex-helpers'
import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SHARE_STATUS } from '../../blockShares/types'
import { checkItemAccess } from '../../sidebarItems/validation'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { ShareStatus } from '../../blockShares/types'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../campaigns/types'
import type { BlockNoteId, BlockShareInfo } from '../types'

export const getBlocksWithShares = async (
  ctx: DmQueryCtx,
  {
    noteId,
    blockNoteIds,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<BlockNoteId>
  },
): Promise<{
  blocks: Array<BlockShareInfo>
  playerMembers: Array<CampaignMember>
}> => {
  const note = await getSidebarItem(ctx, noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const [allMembers, allNoteShares] = await Promise.all([
    getCampaignMembers(ctx),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_note', (q) =>
        q.eq('campaignId', note.campaignId).eq('noteId', noteId),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect(),
  ])

  const playerMembers = allMembers.filter((m) => m.role === CAMPAIGN_MEMBER_ROLE.Player)

  const sharesByBlockId = new Map<Id<'blocks'>, Array<Id<'campaignMembers'>>>()
  for (const share of allNoteShares) {
    const list = sharesByBlockId.get(share.blockId)
    if (list) list.push(share.campaignMemberId)
    else sharesByBlockId.set(share.blockId, [share.campaignMemberId])
  }

  const blocks = await asyncMap(blockNoteIds, async (blockNoteId): Promise<BlockShareInfo> => {
    const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })

    if (!block) {
      return {
        blockNoteId,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        sharedMemberIds: [],
      }
    }

    const shareStatus: ShareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

    const sharedMemberIds =
      shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED ? (sharesByBlockId.get(block._id) ?? []) : []

    return {
      blockNoteId,
      shareStatus,
      sharedMemberIds,
    }
  })

  return {
    blocks,
    playerMembers,
  }
}
