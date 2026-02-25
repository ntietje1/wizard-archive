import type {
  SidebarItemId,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../permissions/types'
import type { Id } from '../_generated/dataModel'

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
