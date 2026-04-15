import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../sidebarItems/types/baseTypes'
import type { SnapshotType } from '../types'

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
