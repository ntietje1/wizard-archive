import type { ShareStatus } from '../blockShares/types'
import type { Id } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'

export type BlockShareInfo = {
  blockNoteId: string
  shareStatus: ShareStatus
  sharedMemberIds: Array<Id<'campaignMembers'>>
  isTopLevel: boolean
}

export type Block = {
  _id: Id<'blocks'>
  _creationTime: number
  noteId: Id<'notes'>
  blockId: string
  position: number | null
  content: CustomBlock
  isTopLevel: boolean
  campaignId: Id<'campaigns'>
  shareStatus: ShareStatus | null
  updatedTime: number | null
  updatedBy: Id<'userProfiles'> | null
  createdBy: Id<'userProfiles'>
  deletionTime: number | null
  deletedBy: Id<'userProfiles'> | null
}
