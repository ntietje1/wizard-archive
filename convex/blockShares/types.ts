import type { CustomBlock } from '../notes/editorSpecs'
import type { Id } from '../_generated/dataModel'

export type BlockShare = {
  _id: Id<'blockShares'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
  campaignMemberId: Id<'campaignMembers'>
  sessionId?: Id<'sessions'>
  updatedTime: number
  updatedBy: Id<'userProfiles'>
  createdBy: Id<'userProfiles'>
}

// Block-specific share status (sidebar items no longer use this)
export const SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type ShareStatus = (typeof SHARE_STATUS)[keyof typeof SHARE_STATUS]

export interface BlockItem {
  blockNoteId: string
  content: CustomBlock
}
