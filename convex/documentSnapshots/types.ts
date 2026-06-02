import type { Id } from '../_generated/dataModel'
import type { SidebarItemType } from '../../shared/sidebar-items/types'
import type { SnapshotType } from '../../shared/document-snapshots/types'

export type DocumentSnapshot = {
  _id: Id<'documentSnapshots'>
  _creationTime: number
  itemId: Id<'sidebarItems'>
  itemType: SidebarItemType
  editHistoryId: Id<'editHistory'>
  campaignId: Id<'campaigns'>
  snapshotType: SnapshotType
  data: ArrayBuffer
}
