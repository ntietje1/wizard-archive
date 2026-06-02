import { asyncMap } from 'convex-helpers'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../../shared/edit-history/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { shareBlockWithMemberHelper } from './blockShareMutations'
import { assertMemberCanReceiveBlockShare } from './noteBlockShareEligibility'
import { getBlockShareNote } from './getBlockShareNote'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'
import type { BlockNoteId } from '../../../shared/editor-blocks/types'

export const shareBlocks = async (
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
  const note = await getBlockShareNote(ctx, noteId)
  await assertMemberCanReceiveBlockShare(ctx, { note, campaignMemberId })

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
