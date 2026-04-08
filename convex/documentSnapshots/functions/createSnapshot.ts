import type { MutationCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../../sidebarItems/types/baseTypes'
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
    createdBy,
  }: {
    itemId: SidebarItemId
    itemType: SidebarItemType
    editHistoryId: Id<'editHistory'>
    campaignId: Id<'campaigns'>
    snapshotType: SnapshotType
    data: ArrayBuffer
    createdBy: Id<'userProfiles'>
  },
): Promise<Id<'documentSnapshots'>> {
  return ctx.db.insert('documentSnapshots', {
    itemId,
    itemType,
    editHistoryId,
    campaignId,
    snapshotType,
    data,
    createdBy,
    updatedTime: null,
    updatedBy: null,
    deletionTime: null,
    deletedBy: null,
  })
}
