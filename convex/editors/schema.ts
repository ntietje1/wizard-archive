import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'
import { EDITOR_MODE, SORT_DIRECTIONS, SORT_ORDERS } from './types'

export const sortOrderValidator = v.union(
  v.literal(SORT_ORDERS.Alphabetical),
  v.literal(SORT_ORDERS.DateCreated),
  v.literal(SORT_ORDERS.DateModified),
)

export const sortDirectionValidator = v.union(
  v.literal(SORT_DIRECTIONS.Ascending),
  v.literal(SORT_DIRECTIONS.Descending),
)

export const editorModeValidator = v.union(
  v.literal(EDITOR_MODE.VIEWER),
  v.literal(EDITOR_MODE.EDITOR),
)

const editorTableFields = {
  userId: v.id('userProfiles'),
  campaignId: v.id('campaigns'),
  sortOrder: sortOrderValidator,
  sortDirection: sortDirectionValidator,
  editorMode: editorModeValidator,
}

export const editorTables = {
  editor: defineTable({
    ...commonTableFields,
    ...editorTableFields,
  }).index('by_campaign_user', ['campaignId', 'userId']),
}

const editorValidatorFields = {
  ...commonValidatorFields('editor'),
  ...editorTableFields,
}

export const editorValidator = v.object(editorValidatorFields)
