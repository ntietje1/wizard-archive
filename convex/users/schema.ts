import { defineTable } from 'convex/server'
import { v } from 'convex/values'

const userProfileTableFields = {
  clerkUserId: v.string(),
  username: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  updatedAt: v.number(),
}

export const userTables = {
  userProfiles: defineTable({
    ...userProfileTableFields,
  })
    .index('by_user', ['clerkUserId'])
    .index('by_username', ['username']),
}

const userProfileValidatorFields = {
  _id: v.id('userProfiles'),
  _creationTime: v.number(),
  ...userProfileTableFields,
} as const

export const userProfileValidator = v.object(userProfileValidatorFields)
