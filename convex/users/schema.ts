import { defineTable } from 'convex/server'
import { v } from 'convex/values'
import type { Validator } from 'convex/values'
import type { UserProfileId } from '@wizard-archive/editor/resources/domain-id'

export const userProfileIdValidator = v.string() as Validator<UserProfileId>

const profileImageValidator = v.nullable(
  v.union(
    v.object({ type: v.literal('external'), url: v.string() }),
    v.object({ type: v.literal('storage'), storageId: v.id('_storage') }),
  ),
)

const userProfileTableFields = {
  userProfileUuid: userProfileIdValidator,
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
    .index('by_userProfileUuid', ['userProfileUuid'])
    .index('by_user', ['authUserId'])
    .index('by_username', ['username']),
}

// profile with profileImage resolved to a direct URL
// only includes convex built-in fields and not commonTableFields (since this would be circular)
const userProfileValidatorFields = {
  id: userProfileIdValidator,
  createdAt: v.number(),
  username: v.string(),
  email: v.nullable(v.string()),
  emailVerified: v.nullable(v.boolean()),
  name: v.nullable(v.string()),
  imageUrl: v.nullable(v.string()),
  twoFactorEnabled: v.nullable(v.boolean()),
}

export const userProfileValidator = v.object(userProfileValidatorFields)

export const userProfileSummaryValidator = v.object({
  username: userProfileValidatorFields.username,
  name: userProfileValidatorFields.name,
  imageUrl: userProfileValidatorFields.imageUrl,
})
