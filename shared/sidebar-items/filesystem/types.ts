import type { SidebarItemLocation, SidebarItemStatus, SidebarItemType } from '../types'
import type { PermissionLevel } from '../../permissions/types'
import type { CampaignId, SidebarItemId, StorageId, UserProfileId } from '../../common/ids'

export type FileSystemSidebarItemRow = {
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

export type FileSystemSidebarItem = FileSystemSidebarItemRow & {
  myPermissionLevel: PermissionLevel
  isBookmarked: boolean
}

export type SidebarItemPatchRow = FileSystemSidebarItemRow
