import type {
  CampaignId,
  CampaignMemberId,
  SessionId,
  SidebarItemId,
  SidebarItemShareId,
} from '../common/ids'
import type { PermissionLevel } from '../permissions/types'
import type { SidebarItemType } from '../sidebar-items/types'

export type SidebarItemShare = {
  _id: SidebarItemShareId
  _creationTime: number
  campaignId: CampaignId
  sidebarItemId: SidebarItemId
  sidebarItemType: SidebarItemType
  campaignMemberId: CampaignMemberId
  sessionId: SessionId | null
  permissionLevel: PermissionLevel | null
}
