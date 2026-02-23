import type { Id } from '../_generated/dataModel'
import type { SidebarItemId } from '../sidebarItems/baseTypes'

export type Bookmark = {
  _id: Id<'bookmarks'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  sidebarItemId: SidebarItemId
  campaignMemberId: Id<'campaignMembers'>
}
