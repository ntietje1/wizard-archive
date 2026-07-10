import { asyncMap } from 'convex-helpers'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { setBlockShareStatusHelper } from './blockShareMutations'
import { getBlockShareNote } from './getBlockShareNote'
import type { BlockShareMutationCtx } from './blockShareMutations'
import type { Id } from '../../_generated/dataModel'
import type { ShareStatus } from '../../../shared/block-shares/share-status'
import type { NoteBlockId } from '@wizard-archive/editor/notes/document-contract'

export const setBlocksShareStatus = async (
  ctx: BlockShareMutationCtx,
  {
    noteId,
    blockNoteIds,
    status,
  }: {
    noteId: Id<'sidebarItems'>
    blockNoteIds: Array<NoteBlockId>
    status: ShareStatus
  },
): Promise<Array<NoteBlockId>> => {
  if (blockNoteIds.length === 0) {
    return []
  }

  const note = await getBlockShareNote(ctx, noteId)

  const changes = await asyncMap(blockNoteIds, async (blockNoteId) => ({
    blockNoteId,
    changed: await setBlockShareStatusHelper(ctx, {
      note,
      blockNoteId,
      status,
    }),
  }))
  const changedBlockNoteIds = changes
    .filter((change) => change.changed)
    .map((change) => change.blockNoteId)

  if (changedBlockNoteIds.length > 0) {
    await logEditHistory(ctx, {
      itemId: noteId,
      itemType: RESOURCE_TYPES.notes,
      action: EDIT_HISTORY_ACTION.block_share_changed,
      metadata: { status, blockCount: changedBlockNoteIds.length },
    })
  }

  return changedBlockNoteIds
}
