import { asyncMap } from 'convex-helpers'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { unshareBlockFromMemberHelper } from './blockShareMutations'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { BlockIdentifier } from '../types'

export const unshareBlocks = async (
  ctx: CampaignMutationCtx,
  {
    noteId,
    blocks,
    campaignMemberId,
  }: {
    noteId: Id<'sidebarItems'>
    blocks: Array<BlockIdentifier>
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

  await asyncMap(blocks, (block) =>
    unshareBlockFromMemberHelper(ctx, {
      note,
      blockNoteId: block.blockNoteId,
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
      blockCount: blocks.length,
    },
  })

  return null
}
