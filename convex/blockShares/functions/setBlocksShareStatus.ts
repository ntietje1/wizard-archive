import { asyncMap } from 'convex-helpers'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../shared/edit-history/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { setBlockShareStatusHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'
import type { ShareStatus } from '../../../shared/editor-blocks/share-status'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'

export const setBlocksShareStatus = async (
  ctx: BlockShareMutationCtx,
  {
    noteId,
    blockNoteIds,
    status,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<BlockNoteId>
    status: ShareStatus
  },
): Promise<null> => {
  if (blockNoteIds.length === 0) {
    return null
  }

  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (rawItem.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.PERMISSION_DENIED, "You don't have access to this campaign")
  }

  await asyncMap(blockNoteIds, (blockNoteId) =>
    setBlockShareStatusHelper(ctx, {
      note: rawItem,
      blockNoteId,
      status,
    }),
  )

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.block_share_changed,
    metadata: { status },
  })

  return null
}
