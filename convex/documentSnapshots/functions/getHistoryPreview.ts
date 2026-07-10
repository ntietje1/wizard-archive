import { readGameMapSnapshot } from '@wizard-archive/editor/game-maps/document-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { resolveHistorySnapshot } from './getSnapshot'
import { HISTORY_ROLLBACK_REJECTION_REASON } from '@wizard-archive/editor/resources/history-contract'
import type { Infer } from 'convex/values'
import type { CampaignQueryCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { historyPreviewValidator } from '../historyPreview'

type HistoryPreview = Infer<typeof historyPreviewValidator>

export async function getHistoryPreview(
  ctx: CampaignQueryCtx,
  { editHistoryId }: { editHistoryId: Id<'editHistory'> },
): Promise<HistoryPreview | null> {
  const resolution = await resolveHistorySnapshot(ctx, { editHistoryId })
  if (resolution.status === 'rejected') {
    return resolution.reason === HISTORY_ROLLBACK_REJECTION_REASON.snapshotUnavailable
      ? null
      : { kind: 'unsupported' }
  }
  const { snapshot } = resolution

  switch (snapshot.itemType) {
    case RESOURCE_TYPES.notes:
      return { kind: 'note-yjs', noteId: snapshot.itemId, data: snapshot.data }
    case RESOURCE_TYPES.canvases:
      return { kind: 'canvas-yjs', canvasId: snapshot.itemId, data: snapshot.data }
    case RESOURCE_TYPES.gameMaps: {
      const snapshotData = readGameMapSnapshot(snapshot.data)
      if (!snapshotData) return { kind: 'unsupported' }
      if (!snapshotData.imageAssetId) {
        return { kind: 'game-map', snapshotData, imageUrlState: { status: 'idle' } }
      }
      const url = await ctx.storage.getUrl(snapshotData.imageAssetId as Id<'_storage'>)
      return {
        kind: 'game-map',
        snapshotData,
        imageUrlState: url ? { status: 'ready', url } : { status: 'error' },
      }
    }
  }
}
