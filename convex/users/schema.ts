import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const userProfileTableFields = {
  authUserId: v.string(),
  username: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  theme: v.optional(
    v.union(v.literal('light'), v.literal('dark'), v.literal('system')),
  ),
}

// does not include commonTableFields because profile needs to exist before tracking these
export const userTables = {
  userProfiles: defineTable({
    ...userProfileTableFields,
  })
    .index('by_user', ['authUserId'])
    .index('by_username', ['username']),
}

// only includes convex built-in fields and not commonTableFields
const userProfileValidatorFields = {
  ...convexValidatorFields('userProfiles'),
  ...userProfileTableFields,
}

export const userProfileValidator = v.object(userProfileValidatorFields)

export const userValidator = v.object({
  _id: v.string(),
  _creationTime: v.number(),
  name: v.string(),
  email: v.string(),
  emailVerified: v.boolean(),
  image: v.optional(v.union(v.null(), v.string())),
  createdAt: v.number(),
  updatedAt: v.number(),
  twoFactorEnabled: v.optional(v.union(v.null(), v.boolean())),
  isAnonymous: v.optional(v.union(v.null(), v.boolean())),
  username: v.optional(v.union(v.null(), v.string())),
  displayUsername: v.optional(v.union(v.null(), v.string())),
  phoneNumber: v.optional(v.union(v.null(), v.string())),
  phoneNumberVerified: v.optional(v.union(v.null(), v.boolean())),
  userId: v.optional(v.union(v.null(), v.string())),
})
