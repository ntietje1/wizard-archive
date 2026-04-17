import { assertUsername } from '../validation'
import type { Username } from '../validation'
import type { QueryCtx } from '../../_generated/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { UserProfile, UserProfileFromDb } from '../types'

function toUserProfileFromDb(profile: Doc<'userProfiles'>): UserProfileFromDb {
  return {
    ...profile,
    username: assertUsername(profile.username),
  }
}

async function enhanceProfile(ctx: QueryCtx, profile: UserProfileFromDb): Promise<UserProfile> {
  let imageUrl: string | null = null
  if (profile.profileImage) {
    if (profile.profileImage.type === 'external') {
      imageUrl = profile.profileImage.url
    } else {
      imageUrl = (await ctx.storage.getUrl(profile.profileImage.storageId)) ?? null
    }
  }
  const { profileImage: _, ...rest } = profile
  return { ...rest, imageUrl }
}

export async function getUserProfileByUserId(
  ctx: QueryCtx,
  { userId }: { userId: string },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', userId))
    .unique()
  if (!profile) return null
  return enhanceProfile(ctx, toUserProfileFromDb(profile))
}

export async function getUserProfileByUsername(
  ctx: QueryCtx,
  { username }: { username: Username },
): Promise<UserProfile | null> {
  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
  if (!profile) return null
  return enhanceProfile(ctx, toUserProfileFromDb(profile))
}

export async function getUserProfileById(
  ctx: QueryCtx,
  { profileId }: { profileId: Id<'userProfiles'> },
): Promise<UserProfile | null> {
  const profile = await ctx.db.get('userProfiles', profileId)
  if (!profile) return null
  return enhanceProfile(ctx, toUserProfileFromDb(profile))
}
