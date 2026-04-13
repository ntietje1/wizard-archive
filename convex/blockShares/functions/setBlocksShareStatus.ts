import { asyncMap } from 'convex-helpers'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { setBlockShareStatusHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { ShareStatus } from '../types'
import type { BlockNoteId } from '../../blocks/types'

export const setBlocksShareStatus = async (
  ctx: CampaignMutationCtx,
  {
    noteId,
    blocks,
    status,
  }: {
    noteId: Id<'sidebarItems'>
    blocks: Array<BlockNoteId>
    status: ShareStatus
  },
): Promise<null> => {
  if (blocks.length === 0) {
    return null
  }

  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.notes)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const note = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await asyncMap(blocks, (blockNoteId) =>
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
