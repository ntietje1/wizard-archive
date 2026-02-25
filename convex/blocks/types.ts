import type { ShareStatus } from '../shares/types'
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
  position?: number
  content: CustomBlock
  isTopLevel: boolean
  campaignId: Id<'campaigns'>
  shareStatus?: ShareStatus
  updatedTime: number
  updatedBy: Id<'userProfiles'>
  createdBy: Id<'userProfiles'>
}
