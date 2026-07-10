import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { setBlocksMemberPermissionHelper } from './blockShareMutations'
import {
  requireAcceptedPlayerMember,
  requireCampaignMember,
} from '../../campaigns/functions/acceptedPlayerMember'
import { getBlockShareNote } from './getBlockShareNote'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { NoteBlockId } from '@wizard-archive/editor/notes/document-contract'

type BlockMemberPermissionHistoryStatus = 'shared' | 'unshared'

export const setBlockMemberPermission = async (
  ctx: BlockShareMutationCtx,
  {
    noteId,
    blockNoteIds,
    campaignMemberId,
    permissionLevel,
    historyStatus,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<NoteBlockId>
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: Extract<PermissionLevel, 'none' | 'view'> | null
    historyStatus?: BlockMemberPermissionHistoryStatus
  },
): Promise<Array<NoteBlockId>> => {
  if (blockNoteIds.length === 0) return []

  const note = await getBlockShareNote(ctx, noteId)
  const memberArgs = { campaignId: note.campaignId, campaignMemberId }
  await (permissionLevel === null
    ? requireCampaignMember(ctx, memberArgs)
    : requireAcceptedPlayerMember(ctx, memberArgs))

  const changedBlockNoteIds = await setBlocksMemberPermissionHelper(ctx, {
    note,
    blockNoteIds,
    campaignMemberId,
    permissionLevel,
  })

  if (changedBlockNoteIds.length > 0) {
    await logEditHistory(ctx, {
      itemId: noteId,
      itemType: RESOURCE_TYPES.notes,
      action: EDIT_HISTORY_ACTION.block_share_changed,
      metadata: {
        status: historyStatus ?? permissionLevel ?? 'default',
        memberId: campaignMemberId,
        blockCount: changedBlockNoteIds.length,
      },
    })
  }

  return changedBlockNoteIds
}
