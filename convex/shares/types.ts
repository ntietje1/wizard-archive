import type { SidebarItemType } from '../sidebarItems/baseTypes'
import type { Id } from '../_generated/dataModel'

export const PERMISSION_LEVEL = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
  FULL_ACCESS: 'full_access',
} as const

export type PermissionLevel =
  (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL]

export const ATLEAST_PERMISSION_LEVEL: Record<
  PermissionLevel,
  Array<PermissionLevel>
> = {
  [PERMISSION_LEVEL.FULL_ACCESS]: [PERMISSION_LEVEL.FULL_ACCESS],
  [PERMISSION_LEVEL.EDIT]: [
    PERMISSION_LEVEL.EDIT,
    PERMISSION_LEVEL.FULL_ACCESS,
  ],
  [PERMISSION_LEVEL.VIEW]: [
    PERMISSION_LEVEL.VIEW,
    PERMISSION_LEVEL.EDIT,
    PERMISSION_LEVEL.FULL_ACCESS,
  ],
  [PERMISSION_LEVEL.NONE]: [
    PERMISSION_LEVEL.NONE,
    PERMISSION_LEVEL.VIEW,
    PERMISSION_LEVEL.EDIT,
    PERMISSION_LEVEL.FULL_ACCESS,
  ],
}

export type SidebarItemShare = {
  _id: Id<'sidebarItemShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: Id<'notes'> | Id<'folders'> | Id<'gameMaps'> | Id<'files'>
  sidebarItemType: SidebarItemType
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
  permissionLevel?: PermissionLevel
}

export type BlockShare = {
  _id: Id<'blockShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
}

// Block-specific share status (sidebar items no longer use this)
export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]
