import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import type { DOCUMENT_SNAPSHOT_TYPE } from '../types'

type CreateSnapshotArgs = {
  itemId: Id<'sidebarItems'>
  editHistoryId: Id<'editHistory'>
  campaignId: Id<'campaigns'>
  data: ArrayBuffer
} & (
  | {
      itemType: typeof RESOURCE_TYPES.notes | typeof RESOURCE_TYPES.canvases
      snapshotType: typeof DOCUMENT_SNAPSHOT_TYPE.YjsState
    }
  | {
      itemType: typeof RESOURCE_TYPES.gameMaps
      snapshotType: typeof DOCUMENT_SNAPSHOT_TYPE.GameMap
    }
)

export async function createSnapshot(
  ctx: MutationCtx,
  { itemId, itemType, editHistoryId, campaignId, snapshotType, data }: CreateSnapshotArgs,
): Promise<Id<'documentSnapshots'>> {
  return ctx.db.insert('documentSnapshots', {
    itemId,
    itemType,
    editHistoryId,
    campaignId,
    snapshotType,
    data,
  })
}
