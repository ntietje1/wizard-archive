import { Id } from '../_generated/dataModel'
import { Tag } from '../tags/types'

export type Share = Tag & {
  tagId: Id<'tags'>
  shareId: Id<'shares'>
  memberId?: Id<'campaignMembers'>
}
