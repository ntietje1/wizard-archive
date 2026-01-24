import type { CustomPartialBlock } from './editorSpecs'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebarItems/baseTypes'

export type NoteFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.notes>

export type Note = SidebarItem<typeof SIDEBAR_ITEM_TYPES.notes>

export type NoteWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.notes
> & {
  content: Array<CustomPartialBlock>
}
