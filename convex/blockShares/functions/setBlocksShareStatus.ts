import { asyncMap } from 'convex-helpers'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../shared/edit-history/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { setBlockShareStatusHelper } from './blockShareMutations'
import { getBlockShareNote } from './getBlockShareNote'
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

  const note = await getBlockShareNote(ctx, noteId)

  await asyncMap(blockNoteIds, (blockNoteId) =>
    setBlockShareStatusHelper(ctx, {
      note,
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
