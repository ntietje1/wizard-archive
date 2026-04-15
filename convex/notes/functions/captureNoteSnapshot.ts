import { NOTE_SNAPSHOT_TYPE } from '../types'
import { captureYjsState } from '../../yjsSync/functions/captureYjsState'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function captureNoteSnapshot(
  ctx: MutationCtx,
  {
    noteId,
    editHistoryId,
    campaignId,
  }: {
    noteId: Id<'sidebarItems'>
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
  },
): Promise<void> {
  await captureYjsState(ctx, {
    documentId: noteId,
    snapshotType: NOTE_SNAPSHOT_TYPE,
    editHistoryId,
    campaignId,
  })
}
