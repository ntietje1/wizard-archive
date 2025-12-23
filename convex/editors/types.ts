import type { Id } from '../_generated/dataModel'

export const SORT_ORDERS = {
  Alphabetical: 'Alphabetical',
  DateCreated: 'DateCreated',
  DateModified: 'DateModified',
} as const

export type SortOrder = (typeof SORT_ORDERS)[keyof typeof SORT_ORDERS]

export const SORT_DIRECTIONS = {
  Ascending: 'Ascending',
  Descending: 'Descending',
} as const

export type SortDirection =
  (typeof SORT_DIRECTIONS)[keyof typeof SORT_DIRECTIONS]

export interface SortOptions {
  order: SortOrder
  direction: SortDirection
}

export type Editor = {
  _id: Id<'editor'>
  _creationTime: number

  campaignId: Id<'campaigns'>
  userId: Id<'userProfiles'>
  sortOrder: SortOrder
  sortDirection: SortDirection
}
