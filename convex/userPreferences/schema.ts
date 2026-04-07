import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { commonTableFields, commonValidatorFields } from '../common/schema'

const panelPreferenceValidator = v.object({
  size: v.union(v.number(), v.null()),
  visible: v.union(v.boolean(), v.null()),
})

const userPreferencesTableFields = {
  userId: v.id('userProfiles'),
  theme: v.union(
    v.literal('light'),
    v.literal('dark'),
    v.literal('system'),
    v.null(),
  ),
  panelPreferences: v.union(
    v.record(v.string(), panelPreferenceValidator),
    v.null(),
  ),
}

export { panelPreferenceValidator }

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
