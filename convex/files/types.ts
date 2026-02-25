import type { Id } from '../_generated/dataModel'
import type {
  SIDEBAR_ITEM_TYPES,
  SidebarItem,
  SidebarItemFromDb,
  SidebarItemWithContent,
} from '../sidebarItems/types/baseTypes'

export type FileFromDb = SidebarItemFromDb<typeof SIDEBAR_ITEM_TYPES.files> & {
  storageId: Id<'_storage'> | null
}

export type SidebarFile = SidebarItem<typeof SIDEBAR_ITEM_TYPES.files> & {
  storageId: Id<'_storage'> | null
  downloadUrl: string | null
  contentType: string | null
}

export type FileWithContent = SidebarItemWithContent<
  typeof SIDEBAR_ITEM_TYPES.files
> & {
  storageId: Id<'_storage'> | null
  downloadUrl: string | null
  contentType: string | null
}
