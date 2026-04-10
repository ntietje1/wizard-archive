import type { Id } from '../_generated/dataModel'
import type { CommonTableFields } from '../common/types'
import type { SidebarItemType } from '../sidebarItems/types/baseTypes'
import type { SNAPSHOT_TYPE } from './schema'

export type SnapshotType = (typeof SNAPSHOT_TYPE)[keyof typeof SNAPSHOT_TYPE]

export type DocumentSnapshot = {
  _id: Id<'documentSnapshots'>
  _creationTime: number
  itemId: Id<'sidebarItems'>
  itemType: SidebarItemType
  editHistoryId: Id<'editHistory'>
  campaignId: Id<'campaigns'>
  snapshotType: SnapshotType
  data: ArrayBuffer
} & CommonTableFields
