import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../../shared/sidebar-items/types'
import type { SnapshotType } from '../../../shared/document-snapshots/types'

export async function createSnapshot(
  ctx: MutationCtx,
  {
    itemId,
    itemType,
    editHistoryId,
    campaignId,
    snapshotType,
    data,
  }: {
    itemId: Id<'sidebarItems'>
    itemType: SidebarItemType
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    snapshotType: SnapshotType
    data: ArrayBuffer
  },
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
