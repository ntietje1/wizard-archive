import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { getBlockSharePlayers } from './getBlockSharePlayers'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMember } from '../../../shared/campaigns/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'
import type { BlockShareInfo } from '../types'

function normalizeBlockMemberPermission(
  permissionLevel: PermissionLevel | null | undefined,
): Extract<PermissionLevel, 'none' | 'view'> {
  return normalizeExplicitSharePermissionLevel(permissionLevel) === PERMISSION_LEVEL.NONE
    ? PERMISSION_LEVEL.NONE
    : PERMISSION_LEVEL.VIEW
}

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
  notePermissionsByMemberId: Record<Id<'campaignMembers'>, PermissionLevel>
}> => {
  const note = await getSidebarItem<'notes'>(ctx, noteId)
  if (!note || note.type !== SIDEBAR_ITEM_TYPES.notes) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  }
  await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })

  const [sharePlayers, allNoteShares] = await Promise.all([
    getBlockSharePlayers(ctx, note),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_note', (q) =>
        q.eq('campaignId', note.campaignId).eq('noteId', noteId),
      )
      .collect(),
  ])

  const sharesByBlockId = new Map<
    Id<'blocks'>,
    Record<Id<'campaignMembers'>, Extract<PermissionLevel, 'none' | 'view'>>
  >()
  for (const share of allNoteShares) {
    const permissions = sharesByBlockId.get(share.blockId) ?? {}
    permissions[share.campaignMemberId] = normalizeBlockMemberPermission(share.permissionLevel)
    sharesByBlockId.set(share.blockId, permissions)
  }
  const notePermissionsByMemberId = Object.fromEntries(
    sharePlayers.notePermissionByMemberId,
  ) as Record<Id<'campaignMembers'>, PermissionLevel>

  const blocks = await asyncMap(blockNoteIds, async (blockNoteId): Promise<BlockShareInfo> => {
    const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })

    if (!block) {
      return {
        blockNoteId,
        shareStatus: SHARE_STATUS.NOT_SHARED,
        memberPermissions: {},
      }
    }

    const shareStatus: ShareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED
    const memberPermissions = sharesByBlockId.get(block._id) ?? {}

    return {
      blockNoteId,
      shareStatus,
      memberPermissions,
    }
  })

  return {
    blocks,
    playerMembers: sharePlayers.playerMembers,
    notePermissionsByMemberId,
  }
}
