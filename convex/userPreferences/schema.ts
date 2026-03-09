import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

const userPreferencesTableFields = {
  userId: v.id('userProfiles'),
  sidebarWidth: v.optional(v.number()),
  isSidebarExpanded: v.optional(v.boolean()),
  theme: v.optional(
    v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
  ),
}

export const userPreferencesTables = {
  userPreferences: defineTable({
    ...commonTableFields,
    ...userPreferencesTableFields,
  }).index('by_user', ['userId']),
}

const userPreferencesValidatorFields = {
  ...commonValidatorFields('userPreferences'),
  ...userPreferencesTableFields,
}

export const userPreferencesValidator = v.object(userPreferencesValidatorFields)
