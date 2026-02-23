import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'
import type { SidebarItemId } from '../sidebarItems/baseTypes'

export type Bookmark = CommonValidatorFields<'bookmarks'> & {
  campaignId: Id<'campaigns'>
  sidebarItemId: SidebarItemId
  campaignMemberId: Id<'campaignMembers'>
}
