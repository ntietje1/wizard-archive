import { asyncMap } from 'convex-helpers'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { shareBlockWithMemberHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ensureBlocksPersisted } from '../../blocks/functions/ensureBlocksPersisted'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../blocks/types'

export const shareBlocks = async (
  ctx: CampaignMutationCtx,
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
  const note = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  await ensureBlocksPersisted(ctx, { noteId })

  await asyncMap(blockNoteIds, (blockNoteId) =>
    shareBlockWithMemberHelper(ctx, {
      note,
      blockNoteId,
      campaignMemberId,
    }),
  )

  await logEditHistory(ctx, {
    itemId: noteId,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    action: EDIT_HISTORY_ACTION.block_share_changed,
    metadata: {
      status: 'shared',
      campaignMemberId,
      blockCount: blockNoteIds.length,
    },
  })

  return null
}
