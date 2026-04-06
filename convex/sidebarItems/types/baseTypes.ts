import type { Folder } from '../../folders/types'
import type { Id } from '../../_generated/dataModel'
import type { CommonTableFields } from '../../common/types'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../../sidebarShares/types'

export const SIDEBAR_ITEM_LOCATION = {
  sidebar: 'sidebar',
  trash: 'trash',
} as const

export type SidebarItemLocation =
  (typeof SIDEBAR_ITEM_LOCATION)[keyof typeof SIDEBAR_ITEM_LOCATION]

export const SIDEBAR_ITEM_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
  canvases: 'canvas',
} as const

export type SidebarItemTable = keyof typeof SIDEBAR_ITEM_TYPES

export type SidebarItemType = (typeof SIDEBAR_ITEM_TYPES)[SidebarItemTable]

type SidebarItemTypeToTableNameMap = {
  [K in SidebarItemTable as (typeof SIDEBAR_ITEM_TYPES)[K]]: K
}

type SidebarItemTypeToTableName<T extends SidebarItemType> =
  SidebarItemTypeToTableNameMap[T]

export type SidebarItemId = {
  [K in SidebarItemTable]: Id<K>
}[SidebarItemTable]

export type SidebarItemFromDb<T extends SidebarItemType> = {
  _id: Id<SidebarItemTypeToTableName<T>>
  _creationTime: number

  name: string
  iconName: string | null
  color: string | null
  slug: string
  campaignId: Id<'campaigns'>
  parentId: Id<'folders'> | null
  type: T
  allPermissionLevel: PermissionLevel | null
  location: SidebarItemLocation
  previewStorageId: Id<'_storage'> | null
  previewLockedUntil: number | null
  previewClaimToken: string | null
  previewUpdatedAt: number | null
} & CommonTableFields

export type SidebarItem<T extends SidebarItemType> = SidebarItemFromDb<T> & {
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
  previewUrl: string | null
}

export type SidebarItemWithContent<T extends SidebarItemType> =
  SidebarItem<T> & {
    ancestors: Array<Folder>
  }
