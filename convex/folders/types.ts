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

export const FOLDER_HISTORY_ACTION = {} as const

export type FolderHistoryMetadataMap = Record<string, never>
