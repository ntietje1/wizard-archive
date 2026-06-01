import type { SidebarItemLocation, SidebarItemStatus, SidebarItemType } from '../types'
import type { PermissionLevel } from '../../permissions/types'

export type SharedId<TableName extends string> = string & { __tableName: TableName }
export type CampaignId = SharedId<'campaigns'>
export type UserProfileId = SharedId<'userProfiles'>
export type StorageId = SharedId<'_storage'>
export type FileSystemTransactionId = SharedId<'filesystemTransactions'>
export type SidebarItemId = SharedId<'sidebarItems'>

export type AnySidebarItemRow = {
  _id: SidebarItemId
  _creationTime: number
  name: string
  slug: string
  parentId: SidebarItemId | null
  campaignId: CampaignId
  type: SidebarItemType
  color: string | null
  iconName: string | null
  location: SidebarItemLocation
  status: SidebarItemStatus
  allPermissionLevel: PermissionLevel | null
  updatedTime: number | null
  updatedBy: UserProfileId | null
  createdBy: UserProfileId
  deletionTime: number | null
  deletedBy: UserProfileId | null
  previewStorageId: StorageId | null
  previewClaimToken: string | null
  previewLockedUntil: number | null
  previewUpdatedAt: number | null
}

export type AnySidebarItem = AnySidebarItemRow & {
  myPermissionLevel: PermissionLevel
  isBookmarked: boolean
}

export type SidebarItemPatchRow = AnySidebarItemRow
