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

  const existingProfile = await getUserProfileByUserId(ctx, {
    userId: identity.subject,
  })

  if (existingProfile) {
    const profile = existingProfile
    const updates: Partial<Doc<'userProfiles'>> = {}

    if (identity.name && identity.name !== profile.name) {
      updates.name = identity.name
    }

    if (identity.email && identity.email !== profile.email) {
      updates.email = identity.email
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
    const baseUsername =
      identity.preferredUsername ||
      (identity.email ? identity.email.split('@')[0] : undefined) ||
      identity.name?.toLowerCase().replace(/\s+/g, '') ||
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
      authUserId: identity.subject,
      username: uniqueUsername,
      email: identity.email,
      name: identity.name,
      imageUrl: identity.pictureUrl,
    })
  }
}
