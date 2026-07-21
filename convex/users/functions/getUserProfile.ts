import { assertStoredUsername } from '../validation'
import type { Username } from '../../../shared/users/validation'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import type { Doc, Id } from '../../_generated/dataModel'
import type { UserProfile } from '../../../shared/users/types'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'

async function enhanceProfile(ctx: QueryCtx, profile: Doc<'userProfiles'>): Promise<UserProfile> {
  let imageUrl: string | null = null
  if (profile.profileImage) {
    if (profile.profileImage.type === 'external') {
      imageUrl = profile.profileImage.url
    } else {
      imageUrl = (await ctx.storage.getUrl(profile.profileImage.storageId)) ?? null
    }
  }
  return {
    id: assertDomainId(DOMAIN_ID_KIND.userProfile, profile.userProfileUuid),
    createdAt: profile._creationTime,
    username: assertStoredUsername(profile.username),
    email: profile.email,
    emailVerified: profile.emailVerified,
    name: profile.name,
    twoFactorEnabled: profile.twoFactorEnabled,
    imageUrl,
  }
}

export async function getUserProfileByAuthProfileKey(
  ctx: QueryCtx,
  { authProfileKey }: { authProfileKey: string },
): Promise<UserProfile | null> {
  const profile = await getUserProfileDocByAuthProfileKey(ctx, { authProfileKey })
  if (!profile) return null
  return enhanceProfile(ctx, profile)
}

export async function getUserProfileDocByAuthProfileKey(
  ctx: QueryCtx | MutationCtx,
  { authProfileKey }: { authProfileKey: string },
): Promise<Doc<'userProfiles'> | null> {
  return await ctx.db
    .query('userProfiles')
    .withIndex('by_user', (q) => q.eq('authUserId', authProfileKey))
    .unique()
}

export async function getUserProfileByUsername(
  ctx: QueryCtx,
  { username }: { username: Username },
): Promise<UserProfile | null> {
  const profile = await getUserProfileDocByUsername(ctx, { username })
  if (!profile) return null
  return enhanceProfile(ctx, profile)
}

export async function getUserProfileDocByUsername(
  ctx: QueryCtx | MutationCtx,
  { username }: { username: Username },
): Promise<Doc<'userProfiles'> | null> {
  return await ctx.db
    .query('userProfiles')
    .withIndex('by_username', (q) => q.eq('username', username))
    .unique()
}

export async function getUserProfileById(
  ctx: QueryCtx,
  { profileId }: { profileId: Id<'userProfiles'> },
): Promise<UserProfile | null> {
  const profile = await ctx.db.get('userProfiles', profileId)
  if (!profile) return null
  return enhanceProfile(ctx, profile)
}
