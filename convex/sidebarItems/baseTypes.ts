import type { Folder } from '../folders/types'
import type { Id } from '../_generated/dataModel'
import type { ShareStatus, SidebarItemShare } from '../shares/types'

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

export type SidebarItemId =
  | Id<'notes'>
  | Id<'folders'>
  | Id<'gameMaps'>
  | Id<'files'>

export type SidebarItemFromDb<T extends SidebarItemType> = {
  _id: Id<SidebarItemTypeToTableName<T>>
  _creationTime: number

  name?: string
  iconName?: string
  color?: string
  slug: string
  campaignId: Id<'campaigns'>
  parentId?: Id<'folders'>
  updatedAt: number
  type: T
  shareStatus?: ShareStatus
}

export type SidebarItem<T extends SidebarItemType> = SidebarItemFromDb<T> & {
  shares: Array<SidebarItemShare>
  isBookmarked: boolean
}

export type SidebarItemWithContent<T extends SidebarItemType> =
  SidebarItem<T> & {
    ancestors: Array<Folder>
  }

export const DEFAULT_ITEM_COLOR = '#14b8a6'
