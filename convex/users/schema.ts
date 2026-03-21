import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const userProfileTableFields = {
  authUserId: v.string(),
  username: v.string(),
  email: v.union(v.string(), v.null()),
  emailVerified: v.union(v.boolean(), v.null()),
  name: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  imageStorageId: v.union(v.id('_storage'), v.null()),
  twoFactorEnabled: v.union(v.boolean(), v.null()),
}

// does not include commonTableFields because profile needs to exist before tracking these
export const userTables = {
  userProfiles: defineTable({
    ...userProfileTableFields,
  })
    .index('by_user', ['authUserId'])
    .index('by_username', ['username'])
    .index('by_email', ['email']),
}

// only includes convex built-in fields and not commonTableFields
const userProfileValidatorFields = {
  ...convexValidatorFields('userProfiles'),
  ...userProfileTableFields,
}

export const userProfileValidator = v.object(userProfileValidatorFields)

