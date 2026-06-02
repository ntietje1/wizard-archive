import type { StorageId } from '../common/ids'
import type { SIDEBAR_ITEM_TYPES } from '../sidebar-items/types'
import type {
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebar-items/model-types'

export type FileFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.files> & {
  storageId: StorageId | null
}

export type SidebarFile = SidebarItem<typeof SIDEBAR_ITEM_TYPES.files> & {
  storageId: StorageId | null
  downloadUrl: string | null
  contentType: string | null
}

export type FileWithContent = SidebarItemWithContent<typeof SIDEBAR_ITEM_TYPES.files> & {
  storageId: StorageId | null
  downloadUrl: string | null
  contentType: string | null
}

export const FILE_HISTORY_ACTION = {
  file_replaced: 'file_replaced',
  file_removed: 'file_removed',
} as const

export type FileHistoryMetadataMap = {
  [K in (typeof FILE_HISTORY_ACTION)[keyof typeof FILE_HISTORY_ACTION]]: null
}
