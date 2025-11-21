import { Id } from '../_generated/dataModel'
import { SidebarItem, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { Tag } from '../tags/types'
import { CustomBlock } from './editorSpecs'

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes> & {
  slug: string
  tagId?: Id<'tags'>
  tag?: Tag
}

export const UNTITLED_NOTE_TITLE = 'Untitled Note'

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

//TODO: remove this and move content to regular note type
export type NoteWithContent = Note & { content: CustomBlock[] }
