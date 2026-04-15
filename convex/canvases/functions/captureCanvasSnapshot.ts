import { CANVAS_SNAPSHOT_TYPE } from '../types'
import { captureYjsState } from '../../yjsSync/functions/captureYjsState'
import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'

export async function captureCanvasSnapshot(
  ctx: MutationCtx,
  {
    canvasId,
    editHistoryId,
    campaignId,
  }: {
    canvasId: Id<'sidebarItems'>
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
  },
): Promise<void> {
  await captureYjsState(ctx, {
    documentId: canvasId,
    snapshotType: CANVAS_SNAPSHOT_TYPE,
    editHistoryId,
    campaignId,
  })
}
