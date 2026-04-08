import type { Id } from '../_generated/dataModel'
import type { CommonTableFields } from '../common/types'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'
import type { SNAPSHOT_TYPE } from './schema'

export type SnapshotType = (typeof SNAPSHOT_TYPE)[keyof typeof SNAPSHOT_TYPE]

export type DocumentSnapshot = {
  _id: Id<'documentSnapshots'>
  _creationTime: number
  itemId: SidebarItemId
  itemType: SidebarItemType
  editHistoryId: Id<'editHistory'>
  campaignId: Id<'campaigns'>
  snapshotType: SnapshotType
  data: ArrayBuffer
} & CommonTableFields

export type GameMapSnapshotData = {
  imageStorageId: string | null
  pins: Array<{
    itemId: SidebarItemId
    x: number
    y: number
    visible: boolean
  }>
}
