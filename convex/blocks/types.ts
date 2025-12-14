import type { Id } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'

export type Block = {
  _id: Id<'blocks'>
  _creationTime: number
  noteId: Id<'notes'>
  blockId: string
  position?: number
  content: CustomBlock
  isTopLevel: boolean
  campaignId: Id<'campaigns'>
  updatedAt: number
}

export type BlockTag = {
  _id: Id<'blockTags'>
  _creationTime: number
  campaignId: Id<'campaigns'>
  blockId: Id<'blocks'>
  tagId: Id<'tags'>
}
