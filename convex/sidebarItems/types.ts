import { Id } from '../_generated/dataModel'
import { GameMap } from '../gameMaps/types'
import { Note } from '../notes/types'
import { Folder } from '../folders/types'
import { TagCategory, Tag } from '../tags/types'

export const SIDEBAR_ROOT_TYPE = 'root' as const

export const SIDEBAR_ITEM_TYPES = {
  notes: 'notes',
  folders: 'folders',
  gameMaps: 'gameMaps',
  tagCategories: 'tagCategories',
  tags: 'tags',
} as const

export type SidebarItemType =
  (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export const SIDEBAR_ITEM_OR_ROOT_TYPES = {
  ...SIDEBAR_ITEM_TYPES,
  root: SIDEBAR_ROOT_TYPE,
} as const

export type SidebarItemOrRootType =
  (typeof SIDEBAR_ITEM_OR_ROOT_TYPES)[keyof typeof SIDEBAR_ITEM_OR_ROOT_TYPES]

export type SidebarItem<T extends SidebarItemType> = {
  _id: Id<T>
  _creationTime: number

  name?: string
  iconName?: string
  slug: string
  campaignId: Id<'campaigns'>
  categoryId?: Id<'tagCategories'>
  parentId?: SidebarItemId
  updatedAt: number
  type: T
}

export type AnySidebarItem = Note | Folder | GameMap | TagCategory | Tag

export type SidebarItemId =
  | Id<'notes'>
  | Id<'folders'>
  | Id<'tagCategories'>
  | Id<'tags'>
  | Id<'gameMaps'>
