import { Id } from '../_generated/dataModel'
import { Note } from '../notes/types'
import { SidebarItem, SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'

export const CATEGORY_KIND = {
  SystemManaged: 'system_managed', // both category and tags under it are immutable to users.
  SystemCore: 'system_core', // immutable category, but tags under them are user-mutable.
  User: 'user', // both category and tags under it are user mutable
} as const

export const SYSTEM_DEFAULT_CATEGORIES = {
  Character: {
    name: 'Character',
    pluralName: 'Characters',
    slug: 'characters',
    iconName: 'User',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#ef4444',
  },
  Location: {
    name: 'Location',
    pluralName: 'Locations',
    slug: 'locations',
    iconName: 'MapPin',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#3B82F6',
  },
  Session: {
    name: 'Session',
    pluralName: 'Sessions',
    slug: 'sessions',
    iconName: 'Calendar',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#22C55E',
  },
  Shared: {
    name: 'Shares',
    pluralName: 'Shares',
    slug: 'shares',
    iconName: 'Share2',
    kind: CATEGORY_KIND.SystemManaged,
    defaultColor: '#F59E0B',
  },
}

export const SHARED_TAG_COLOR = '#F59E0B'

export type CategoryKind = (typeof CATEGORY_KIND)[keyof typeof CATEGORY_KIND]

export type TagCategory = SidebarItem<
  typeof SIDEBAR_ITEM_TYPES.tagCategories
> & {
  pluralName?: string
  kind: CategoryKind
  defaultColor?: string
  createdBy: Id<'campaignMembers'>
}

export type Tag = Omit<
  SidebarItem<typeof SIDEBAR_ITEM_TYPES.tags>,
  'categoryId'
> & {
  color?: string
  description?: string
  categoryId: Id<'tagCategories'> // Required for tags, not optional
  category?: TagCategory
  imageStorageId?: Id<'_storage'>
  createdBy: Id<'campaignMembers'>
}

export type TagWithNote = Tag & {
  note: Note
}
