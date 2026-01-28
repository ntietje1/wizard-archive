import type { SidebarItemType } from '../sidebarItems/baseTypes'
import type { Id } from '../_generated/dataModel'

export type SidebarItemShare = {
  _id: Id<'sidebarItemShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: Id<'notes'> | Id<'folders'> | Id<'gameMaps'> | Id<'files'>
  sidebarItemType: SidebarItemType
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
}

export type BlockShare = {
  _id: Id<'blockShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
}

export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]

export const PERMISSION_STATUS = {
  NO_ACCESS: 'no_access',
  VIEW: 'view',
  EDIT: 'edit',
} as const

export type PermissionStatus =
  (typeof PERMISSION_STATUS)[keyof typeof PERMISSION_STATUS]
