import type { CustomPartialBlock } from './editorSpecs'
import type { SIDEBAR_ITEM_TYPES, SidebarItem } from '../sidebarItems/types'

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes>

export type NoteWithContent = Note & {
  content: Array<CustomPartialBlock>
}
