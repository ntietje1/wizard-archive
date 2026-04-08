import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import { convexValidatorFields } from '../common/schema'

const profileImageValidator = v.union(
  v.object({ type: v.literal('external'), url: v.string() }),
  v.object({ type: v.literal('storage'), storageId: v.id('_storage') }),
  v.null(),
)

const userProfileTableFields = {
  authUserId: v.string(),
  username: v.string(),
  email: v.union(v.string(), v.null()),
  emailVerified: v.union(v.boolean(), v.null()),
  name: v.union(v.string(), v.null()),
  profileImage: profileImageValidator,
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

// profile with profileImage resolved to a direct URL
// only includes convex built-in fields and not commonTableFields (since this would be circular)
const userProfileValidatorFields = {
  ...convexValidatorFields('userProfiles'),
  authUserId: v.string(),
  username: v.string(),
  email: v.union(v.string(), v.null()),
  emailVerified: v.union(v.boolean(), v.null()),
  name: v.union(v.string(), v.null()),
  imageUrl: v.union(v.string(), v.null()),
  twoFactorEnabled: v.union(v.boolean(), v.null()),
}

export const userProfileValidator = v.object(userProfileValidatorFields)
