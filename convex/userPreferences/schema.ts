import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { convexValidatorFields } from '../common/schema'

const userPreferencesTableFields = {
  userId: v.id('userProfiles'),
  theme: v.nullable(literals('light', 'dark', 'system')),
}

export const userPreferencesTables = {
  userPreferences: defineTable({
    ...userPreferencesTableFields,
  }).index('by_user', ['userId']),
}

const userPreferencesValidatorFields = {
  ...convexValidatorFields('userPreferences'),
  ...userPreferencesTableFields,
}

export const userPreferencesValidator = v.object(userPreferencesValidatorFields)
