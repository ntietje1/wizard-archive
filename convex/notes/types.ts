import { Id } from '../_generated/dataModel'
import { SidebarItem, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { Tag } from '../tags/types'

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes> & {
  slug: string
  tagId?: Id<'tags'>
  tag?: Tag
}

export const UNTITLED_NOTE_TITLE = 'Untitled Note'
export const UNTITLED_FOLDER_NAME = 'Untitled Folder' // For backward compatibility, folders are now notes
