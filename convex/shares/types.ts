import type { Id } from '../_generated/dataModel'
import type { CampaignMember } from '../campaigns/types'
import type { Tag } from '../tags/types'

export type Share = Tag & {
  tagId: Id<'tags'>
  shareId: Id<'shares'>
  memberId?: Id<'campaignMembers'>
  member?: CampaignMember
}
