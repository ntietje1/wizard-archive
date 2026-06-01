import { asyncMap } from 'convex-helpers'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { unshareBlockFromMemberHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'

export const unshareBlocks = async (
  ctx: BlockShareMutationCtx,
  {
    noteId,
    blockNoteIds,
    campaignMemberId,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<BlockNoteId>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<null> => {
  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (rawItem.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }

  await asyncMap(blockNoteIds, (blockNoteId) =>
    unshareBlockFromMemberHelper(ctx, {
      note: rawItem,
      blockNoteId,
      campaignMemberId,
    }),
  )

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.block_share_changed,
    metadata: {
      status: 'unshared',
      campaignMemberId,
      blockCount: blockNoteIds.length,
    },
  })

  return null
}
