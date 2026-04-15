import type { Id } from '../_generated/dataModel'
import type { ConvexValidatorFields } from '../common/types'

export type Bookmark = ConvexValidatorFields<'bookmarks'> & {
  campaignId: Id<'campaigns'>
  sidebarItemId: Id<'sidebarItems'>
  campaignMemberId: Id<'campaignMembers'>
}
