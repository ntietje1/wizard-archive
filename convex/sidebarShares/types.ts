import type { SidebarItemType } from '../../shared/sidebar-items/types'
import type { PermissionLevel } from '../../shared/permissions/types'
import type { Id } from '../_generated/dataModel'

export type SidebarItemShare = {
  _id: Id<'sidebarItemShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: Id<'sidebarItems'>
  sidebarItemType: SidebarItemType
  campaignMemberId: Id<'campaignMembers'>
  sessionId: Id<'sessions'> | null
  permissionLevel: PermissionLevel | null
}
