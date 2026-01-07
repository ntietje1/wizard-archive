import type { Id } from '../_generated/dataModel'
import type { GameMap } from '../gameMaps/types'
import type { Note } from '../notes/types'
import type { Folder } from '../folders/types'
import type { File } from '../files/types'

export const SIDEBAR_ROOT_TYPE = 'root' as const

export const SIDEBAR_ITEM_TYPES = {
  notes: 'notes',
  folders: 'folders',
  gameMaps: 'gameMaps',
  files: 'files',
} as const

export type SidebarItemType =
  (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export const SIDEBAR_ITEM_OR_ROOT_TYPES = {
  ...SIDEBAR_ITEM_TYPES,
  root: SIDEBAR_ROOT_TYPE,
} as const

export type SidebarItemOrRootType =
  (typeof SIDEBAR_ITEM_OR_ROOT_TYPES)[keyof typeof SIDEBAR_ITEM_OR_ROOT_TYPES]

export const SIDEBAR_ITEM_SHARE_STATUS = {
  ALL_SHARED: 'all_shared',
  NOT_SHARED: 'not_shared',
  INDIVIDUALLY_SHARED: 'individually_shared',
} as const

export type SidebarItemShareStatus =
  (typeof SIDEBAR_ITEM_SHARE_STATUS)[keyof typeof SIDEBAR_ITEM_SHARE_STATUS]

export type SidebarItem<T extends SidebarItemType> = {
  _id: Id<T>
  _creationTime: number

  name?: string
  iconName?: string
  color?: string
  slug: string
  campaignId: Id<'campaigns'>
  parentId?: SidebarItemId
  updatedAt: number
  type: T
  shareStatus?: SidebarItemShareStatus
}

export type AnySidebarItem = Note | Folder | GameMap | File

export type SidebarItemId =
  | Id<'notes'>
  | Id<'folders'>
  | Id<'gameMaps'>
  | Id<'files'>
