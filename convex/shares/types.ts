import type { Id } from '../_generated/dataModel'
import type { SidebarItemType } from '../sidebarItems/types'

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
