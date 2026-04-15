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

// Block-specific share status (sidebar items no longer use this)
export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]
