import { Id } from "../_generated/dataModel";
import { Map } from '../maps/types';
import { Note } from "../notes/types";
import { Folder } from '../folders/types';
import { TagCategory } from "../tags/types";


export const SIDEBAR_ROOT_TYPE = 'root' as const

export const SIDEBAR_ITEM_TYPES = {
  notes: 'notes',
  folders: 'folders',
  maps: 'maps',
} as const

export type SidebarItemType = (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

export const SIDEBAR_ITEM_OR_ROOT_TYPES = {
  ...SIDEBAR_ITEM_TYPES,
  root: SIDEBAR_ROOT_TYPE,
} as const

export type SidebarItemOrRootType = (typeof SIDEBAR_ITEM_OR_ROOT_TYPES)[keyof typeof SIDEBAR_ITEM_OR_ROOT_TYPES]

export type SidebarItem<T extends SidebarItemType> = {
  _id: Id<T>
  _creationTime: number

  name?: string
  userId: Id<'userProfiles'>
  campaignId: Id<'campaigns'>
  categoryId?: Id<'tagCategories'>
  category?: TagCategory
  parentFolderId?: Id<'folders'>
  updatedAt: number
  type: T
}

export type AnySidebarItem = Note | Folder | Map

