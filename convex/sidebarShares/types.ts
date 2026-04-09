import type { SidebarItemId, SidebarItemType } from '../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { Id } from '../_generated/dataModel'

export type SidebarItemShare = {
  _id: Id<'sidebarItemShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
  campaignMemberId: Id<'campaignMembers'>
  sessionId: Id<'sessions'> | null
  permissionLevel: PermissionLevel | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
}
