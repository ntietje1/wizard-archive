import { asyncMap } from 'convex-helpers'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { unshareBlockFromMemberHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export const unshareBlocks = async (
  ctx: AuthMutationCtx,
  {
    noteId,
    blockNoteIds,
    campaignMemberId,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<string>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const note = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await requireDmRole(ctx, note.campaignId)

  await asyncMap(blockNoteIds, (blockNoteId) =>
    unshareBlockFromMemberHelper(ctx, {
      note,
      blockNoteId,
      campaignMemberId,
    }),
  )

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    campaignId: note.campaignId,
    action: EDIT_HISTORY_ACTION.block_share_changed,
    metadata: {
      status: 'unshared',
      campaignMemberId,
      blockCount: blockNoteIds.length,
    },
  })

  return null
}
