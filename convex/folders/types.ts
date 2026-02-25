import type { Id } from '../_generated/dataModel'
import type { CustomBlock } from '../notes/editorSpecs'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'

export type FolderFromDb = SidebarItemFromDb<
  typeof SIDEBAR_ITEM_TYPES.folders
> & {
  inheritShares: boolean
}

export type Folder = SidebarItem<typeof SIDEBAR_ITEM_TYPES.folders> & {
  inheritShares: boolean
}

export type FolderWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.folders
> & {
  inheritShares: boolean
}

type DownloadableFile = {
  type: typeof SIDEBAR_ITEM_TYPES.files
  id: Id<'files'>
  name: string
  path: string
  downloadUrl: string | null
}
type DownloadableNote = {
  type: typeof SIDEBAR_ITEM_TYPES.notes
  id: Id<'notes'>
  name: string
  path: string
  content: Array<CustomBlock>
}
type DownloadableMap = {
  type: typeof SIDEBAR_ITEM_TYPES.gameMaps
  id: Id<'gameMaps'>
  name: string
  path: string
  downloadUrl: string | null
}

export type DownloadableItem =
  | DownloadableFile
  | DownloadableNote
  | DownloadableMap
