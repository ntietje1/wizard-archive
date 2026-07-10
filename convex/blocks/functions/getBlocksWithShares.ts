import { asyncMap } from 'convex-helpers'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import { getBlockSharePlayers } from './getBlockSharePlayers'
import { findBlockByBlockNoteId } from './findBlockByBlockNoteId'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import type { ShareStatus } from '../../../shared/block-shares/share-status'
import type { DmQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMemberSummary } from '../../../shared/campaigns/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { NoteBlockId, BlockShareInfo } from '@wizard-archive/editor/notes/document-contract'

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
    blockNoteIds: Array<NoteBlockId>
  },
): Promise<{
  blocks: Array<BlockShareInfo<Id<'campaignMembers'>>>
  playerMembers: Array<CampaignMemberSummary>
  notePermissionsByMemberId: Record<Id<'campaignMembers'>, PermissionLevel>
}> => {
  const note = await getSidebarItem(ctx, noteId)
  if (!note || note.type !== RESOURCE_TYPES.notes) {
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

  const blocks = await asyncMap(
    blockNoteIds,
    async (blockNoteId): Promise<BlockShareInfo<Id<'campaignMembers'>>> => {
      const block = await findBlockByBlockNoteId(ctx, { noteId, blockNoteId })

      if (!block) {
        return {
          noteBlockId: blockNoteId,
          shareStatus: SHARE_STATUS.NOT_SHARED,
          memberPermissions: {},
        }
      }

      const shareStatus: ShareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED
      const memberPermissions = sharesByBlockId.get(block._id) ?? {}

      return {
        noteBlockId: blockNoteId,
        shareStatus,
        memberPermissions,
      }
    },
  )

  return {
    blocks,
    playerMembers: sharePlayers.playerMembers,
    notePermissionsByMemberId,
  }
}
