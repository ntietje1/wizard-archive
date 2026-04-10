import type { Id } from '../_generated/dataModel'
import type { CommonValidatorFields } from '../common/types'

export type Bookmark = CommonValidatorFields<'bookmarks'> & {
  campaignId: Id<'campaigns'>
  sidebarItemId: Id<'sidebarItems'>
  campaignMemberId: Id<'campaignMembers'>
}
