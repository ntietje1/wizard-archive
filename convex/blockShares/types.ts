import type { Id } from '../_generated/dataModel'

export type BlockShare = {
  _id: Id<'blockShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  noteId: Id<'sidebarItems'>
  blockId: Id<'blocks'>
  campaignMemberId: Id<'campaignMembers'>
  sessionId: Id<'sessions'> | null
}
