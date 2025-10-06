import { Id } from '../_generated/dataModel'
import { Note } from '../notes/types'

export const CATEGORY_KIND = {
  SystemManaged: 'system_managed', // both category and tags under it are immutable to users.
  SystemCore: 'system_core', // immutable category, but tags under them are user-mutable.
  User: 'user', // both category and tags under it are user mutable
} as const

export const SYSTEM_DEFAULT_CATEGORIES = {
  Character: {
    displayName: 'Character',
    pluralDisplayName: 'Characters',
    name: 'characters',
    iconName: 'User',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#ef4444',
  },
  Location: {
    displayName: 'Location',
    pluralDisplayName: 'Locations',
    name: 'locations',
    iconName: 'MapPin',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#3B82F6',
  },
  Session: {
    displayName: 'Session',
    pluralDisplayName: 'Sessions',
    name: 'sessions',
    iconName: 'Calendar',
    kind: CATEGORY_KIND.SystemCore,
    defaultColor: '#22C55E',
  },
  Shared: {
    displayName: 'Shares',
    pluralDisplayName: 'Shares',
    name: 'shares',
    iconName: 'Share2',
    kind: CATEGORY_KIND.SystemManaged,
    defaultColor: '#F59E0B',
  },
}

export const SHARED_TAG_COLOR = '#F59E0B'

export type CategoryKind = (typeof CATEGORY_KIND)[keyof typeof CATEGORY_KIND]

export type TagCategory = {
  _id: Id<'tagCategories'>
  _creationTime: number

  name: string
  displayName: string
  pluralDisplayName: string
  kind: CategoryKind
  campaignId: Id<'campaigns'>
  iconName: string
  defaultColor?: string
  updatedAt: number
  createdBy: Id<'campaignMembers'>
}

export type Tag = {
  _id: Id<'tags'>
  _creationTime: number

  displayName: string
  name: string
  color: string
  description?: string
  campaignId: Id<'campaigns'>
  categoryId: Id<'tagCategories'>
  category?: TagCategory
  updatedAt: number
  createdBy: Id<'campaignMembers'>
}

export type TagWithNote = Tag & {
  note: Note
}
