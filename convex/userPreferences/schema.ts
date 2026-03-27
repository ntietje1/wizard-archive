import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

const userPreferencesTableFields = {
  userId: v.id('userProfiles'),
  sidebarWidth: v.union(v.number(), v.null()),
  isSidebarExpanded: v.union(v.boolean(), v.null()),
  theme: v.union(
    v.literal('light'),
    v.literal('dark'),
    v.literal('system'),
    v.null(),
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
