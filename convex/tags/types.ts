import { slugify } from '../common/slug'
import type { Id } from '../_generated/dataModel'
import type { Note } from '../notes/types'
import type { SIDEBAR_ITEM_TYPES, SidebarItem } from '../sidebarItems/types'

export const CATEGORY_KIND = {
  SystemManaged: 'system_managed', // both category and tags under it are immutable to users.
  SystemCore: 'system_core', // immutable category, but tags under them are user-mutable.
  User: 'user', // both category and tags under it are user mutable
} as const

export const SYSTEM_DEFAULT_CATEGORIES = {
  Character: {
    name: 'Characters',
    slug: slugify('Characters'),
    iconName: 'User',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#ef4444',
  },
  Location: {
    name: 'Locations',
    slug: slugify('Locations'),
    iconName: 'MapPin',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#3B82F6',
  },
  Session: {
    name: 'Sessions',
    slug: slugify('Sessions'),
    iconName: 'Calendar',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#22C55E',
  },
  Shared: {
    name: 'Shared',
    slug: slugify('Shared'),
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
