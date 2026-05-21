import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const profileImageValidator = v.nullable(
  v.union(
    v.object({ type: v.literal('external'), url: v.string() }),
    v.object({ type: v.literal('storage'), storageId: v.id('_storage') }),
  ),
)

const userProfileTableFields = {
  authUserId: v.string(),
  username: v.string(),
  email: v.nullable(v.string()),
  emailVerified: v.nullable(v.boolean()),
  name: v.nullable(v.string()),
  profileImage: profileImageValidator,
  twoFactorEnabled: v.nullable(v.boolean()),
}

// does not include commonTableFields because profile needs to exist before tracking these
export const userTables = {
  userProfiles: defineTable({
    ...userProfileTableFields,
  })
    .index('by_user', ['authUserId'])
    .index('by_username', ['username']),
}

// profile with profileImage resolved to a direct URL
// only includes convex built-in fields and not commonTableFields (since this would be circular)
const userProfileValidatorFields = {
  ...convexValidatorFields('userProfiles'),
  authUserId: v.string(),
  username: v.string(),
  email: v.nullable(v.string()),
  emailVerified: v.nullable(v.boolean()),
  name: v.nullable(v.string()),
  imageUrl: v.nullable(v.string()),
  twoFactorEnabled: v.nullable(v.boolean()),
}

export const userProfileValidator = v.object(userProfileValidatorFields)
