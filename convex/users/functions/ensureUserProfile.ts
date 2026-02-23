import { findUniqueSlug } from '../../common/slug'
import { getUserProfileByUserId } from './getUserProfile'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

export async function ensureUserProfile(
  ctx: MutationCtx,
): Promise<Id<'userProfiles'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('User not authenticated')
  }

  const existingProfile = await getUserProfileByUserId(ctx, identity.subject)

  if (existingProfile) {
    // Update existing profile
    const profile = existingProfile
    const updates: Partial<Doc<'userProfiles'>> = {}

    if (identity.username && identity.username !== profile.username) {
      const uniqueUsername = await findUniqueSlug(
        identity.username as string,
        async (name) => {
          const conflict = await ctx.db
            .query('userProfiles')
            .withIndex('by_username', (q) => q.eq('username', name))
            .unique()
          return conflict !== null && conflict._id !== profile._id
        },
      )
      updates.username = uniqueUsername
    }

    if (identity.name && identity.name !== profile.name) {
      updates.name = identity.name
    }

    if (identity.givenName && identity.givenName !== profile.firstName) {
      updates.firstName = identity.givenName
    }

    if (identity.familyName && identity.familyName !== profile.lastName) {
      updates.lastName = identity.familyName
    }

    if (
      identity.pictureUrl !== undefined &&
      identity.pictureUrl !== profile.imageUrl
    ) {
      updates.imageUrl = identity.pictureUrl
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(profile._id, updates)
    }

    return profile._id
  } else {
    // Create new profile
    const baseUsername =
      identity.preferredUsername ||
      (identity.email ? identity.email.split('@')[0] : undefined) ||
      `user${identity.subject.slice(-8)}`

    const uniqueUsername = await findUniqueSlug(
      baseUsername,
      async (username) => {
        const conflict = await ctx.db
          .query('userProfiles')
          .withIndex('by_username', (q) => q.eq('username', username))
          .unique()
        return conflict !== null
      },
    )

    return await ctx.db.insert('userProfiles', {
      clerkUserId: identity.subject,
      username: uniqueUsername,
      email: identity.email,
      name: identity.name,
      firstName: identity.givenName,
      lastName: identity.familyName,
      imageUrl: identity.pictureUrl,
    })
  }
}
