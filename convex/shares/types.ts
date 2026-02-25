import type {
  SidebarItemId,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'
import type { Id } from '../_generated/dataModel'

export const PERMISSION_LEVEL = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
  FULL_ACCESS: 'full_access',
} as const

export type PermissionLevel =
  (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL]

export const PERMISSION_RANK: Record<PermissionLevel, number> = {
  [PERMISSION_LEVEL.NONE]: 0,
  [PERMISSION_LEVEL.VIEW]: 1,
  [PERMISSION_LEVEL.EDIT]: 2,
  [PERMISSION_LEVEL.FULL_ACCESS]: 3,
}

export type SidebarItemShare = {
  _id: Id<'sidebarItemShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
  permissionLevel?: PermissionLevel
  updatedTime: number
  updatedBy: Id<'userProfiles'>
  createdBy: Id<'userProfiles'>
}

export type BlockShare = {
  _id: Id<'blockShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
  updatedTime: number
  updatedBy: Id<'userProfiles'>
  createdBy: Id<'userProfiles'>
}

// Block-specific share status (sidebar items no longer use this)
export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]
