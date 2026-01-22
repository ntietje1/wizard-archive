import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { SORT_DIRECTIONS, SORT_ORDERS } from './types'

export const sortOrderValidator = v.union(
  v.literal(SORT_ORDERS.Alphabetical),
  v.literal(SORT_ORDERS.DateCreated),
  v.literal(SORT_ORDERS.DateModified),
)

export const sortDirectionValidator = v.union(
  v.literal(SORT_DIRECTIONS.Ascending),
  v.literal(SORT_DIRECTIONS.Descending),
)

const editorTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  sortOrder: sortOrderValidator,
  sortDirection: sortDirectionValidator,
  sidebarWidth: v.optional(v.number()),
  isSidebarExpanded: v.optional(v.boolean()),
}

export const editorTables = {
  editor: defineTable({
    ...editorTableFields,
  }).index('by_campaign_user', ['campaignId', 'userId']),
}

const editorValidatorFields = {
  _id: v.id('editor'),
  _creationTime: v.number(),
  ...editorTableFields,
} as const

export const editorValidator = v.object(editorValidatorFields)
