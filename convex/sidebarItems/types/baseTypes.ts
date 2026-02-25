import type { Folder } from '../../folders/types'
import type { Id } from '../../_generated/dataModel'
import type { CommonTableFields } from '../../common/types'
import type { PermissionLevel } from '../../permissions/types'
import type { SidebarItemShare } from '../../sidebarShares/types'

export const SIDEBAR_ROOT_TYPE = 'root' as const

export const SIDEBAR_ITEM_TYPES = {
  notes: 'note',
  folders: 'folder',
  gameMaps: 'gameMap',
  files: 'file',
} as const

export type SidebarItemType =
  (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

type SidebarItemTypeToTableNameMap = {
  [K in keyof typeof SIDEBAR_ITEM_TYPES as (typeof SIDEBAR_ITEM_TYPES)[K]]: K
}

type SidebarItemTypeToTableName<T extends SidebarItemType> =
  SidebarItemTypeToTableNameMap[T]

export const SIDEBAR_ITEM_OR_ROOT_TYPES = {
  ...SIDEBAR_ITEM_TYPES,
  root: SIDEBAR_ROOT_TYPE,
} as const

export type SidebarItemOrRootType =
  (typeof SIDEBAR_ITEM_OR_ROOT_TYPES)[keyof typeof SIDEBAR_ITEM_OR_ROOT_TYPES]

export type SidebarItemId = {
  [K in keyof typeof SIDEBAR_ITEM_TYPES]: Id<K>
}[keyof typeof SIDEBAR_ITEM_TYPES]

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
} & CommonTableFields

export type SidebarItem<T extends SidebarItemType> = SidebarItemFromDb<T> & {
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
  myPermissionLevel: PermissionLevel
}

export type SidebarItemWithContent<T extends SidebarItemType> =
  SidebarItem<T> & {
    ancestors: Array<Folder>
  }

export const DEFAULT_ITEM_COLOR = '#14b8a6'
