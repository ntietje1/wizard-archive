import { Id } from '../_generated/dataModel'
import { Tag, TagCategory } from '../tags/types'
import type { CustomBlock } from './editorSpecs'

export const SIDEBAR_ROOT_TYPE = 'root' as const

export const SIDEBAR_ITEM_TYPES = {
  notes: 'notes',
  folders: 'folders',
} as const

export type SidebarItemType =
  (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export type SidebarItem<T extends SidebarItemType> = {
  _id: Id<T>
  _creationTime: number

  name?: string
  userId: string
  campaignId: Id<'campaigns'>
  categoryId?: Id<'tagCategories'>
  category?: TagCategory
  parentFolderId?: Id<'folders'>
  updatedAt: number
  type: T
}

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes> & {
  tagId?: Id<'tags'>
  tag?: Tag
}

export const UNTITLED_NOTE_TITLE = 'Untitled Note'
export const UNTITLED_FOLDER_NAME = 'Untitled Folder'

export type AnySidebarItem = Note | Folder

export type Folder = SidebarItem<typeof SIDEBAR_ITEM_TYPES.folders> & {
  children?: AnySidebarItem[]
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
