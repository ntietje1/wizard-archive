import { requireUserIdentity } from '../common/identity'
import { findUniqueSlug } from '../common/slug'
import type { UserIdentity } from 'convex/server'
import type { MutationCtx } from '../_generated/server'
import type { Ctx } from '../common/types'
import type { Doc, Id } from '../_generated/dataModel'

export async function getUserProfileByUserIdHandler(ctx: Ctx, userId: string) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('clerkUserId', userId))
    .unique()
  return profile
}

export async function getUserProfileByUsernameHandler(
  ctx: Ctx,
  username: string,
) {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
  return profile
}

export async function createUserProfileHandler(
  ctx: MutationCtx,
  identity: UserIdentity,
): Promise<Id<'userProfiles'>> {
  const baseUsername =
    identity.preferredUsername ||
    identity.email?.split('@')[0] ||
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
    updatedAt: Date.now(),
  })
}

export async function updateUserProfileHandler(
  ctx: MutationCtx,
  identity: UserIdentity,
): Promise<Id<'userProfiles'>> {
  const { profile } = await requireUserIdentity(ctx)
  const updates: Partial<Doc<'userProfiles'>> = {
    updatedAt: Date.now(),
  }

  const username = identity.username as string

  if (username && username !== profile.username) {
    const uniqueUsername = await findUniqueSlug(username, async (name) => {
      const conflict = await ctx.db
        .query('userProfiles')
        .withIndex('by_username', (q) => q.eq('username', name))
        .unique()
      return conflict !== null && conflict._id !== profile._id
    })
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

  // updatedAt is always included
  if (Object.keys(updates).length > 1) {
    await ctx.db.patch(profile._id, updates)
  }

  return profile._id
}

export async function upsertUserProfileHandler(
  ctx: MutationCtx,
): Promise<Id<'userProfiles'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('User not authenticated')
  }

  const existingProfile = await getUserProfileByUserIdHandler(
    ctx,
    identity.subject,
  )

  if (existingProfile) {
    return await updateUserProfileHandler(ctx, identity)
  } else {
    return await createUserProfileHandler(ctx, identity)
  }
}

export async function deleteUserProfileHandler(
  ctx: MutationCtx,
): Promise<void> {
  const { profile } = await requireUserIdentity(ctx)
  await ctx.db.delete(profile._id)
}
