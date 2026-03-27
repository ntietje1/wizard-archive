import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { getCampaignMembers } from '../../campaigns/functions/getCampaignMembers'
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

  const [allMembers, allNoteShares] = await Promise.all([
    getCampaignMembers(ctx, { campaignId: note.campaignId }),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_note', (q) =>
        q.eq('campaignId', note.campaignId).eq('noteId', noteId),
      )
      .filter((q) => q.eq(q.field('deletionTime'), null))
      .collect(),
  ])

  const playerMembers = allMembers.filter(
    (m) => m.role === CAMPAIGN_MEMBER_ROLE.Player,
  )

  const sharesByBlockId = new Map<Id<'blocks'>, Array<Id<'campaignMembers'>>>()
  for (const share of allNoteShares) {
    const list = sharesByBlockId.get(share.blockId)
    if (list) list.push(share.campaignMemberId)
    else sharesByBlockId.set(share.blockId, [share.campaignMemberId])
  }

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

      const sharedMemberIds =
        shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED
          ? (sharesByBlockId.get(block._id) ?? [])
          : []

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
