import { Id } from '../_generated/dataModel'
import { Note } from '../notes/types'

export const CATEGORY_KIND = {
  SystemManaged: 'system_managed', // both category and tags under it are immutable to users.
  SystemCore: 'system_core', // immutable category, but tags under them are user-mutable.
  User: 'user', // both category and tags under it are user mutable
} as const

export const SYSTEM_TAG_CATEGORY_NAMES = {
  Character: 'Character',
  Location: 'Location',
  Session: 'Session',
  Shared: 'Shared',
} as const

export const SHARED_TAG_COLOR = '#F59E0B'

export type CategoryKind = (typeof CATEGORY_KIND)[keyof typeof CATEGORY_KIND]

export type TagCategory = {
  _id: Id<'tagCategories'>
  _creationTime: number

  displayName: string
  name: string
  kind: CategoryKind
  campaignId: Id<'campaigns'>
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
  memberId?: Id<'campaignMembers'>
  updatedAt: number
  createdBy: Id<'campaignMembers'>
}

export type TagWithNote = Tag & {
  note: Note
}
