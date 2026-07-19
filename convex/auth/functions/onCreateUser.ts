import {
  assertUsername,
  deduplicateUsername,
  normalizeUsernameCandidate,
  parseUsername,
} from '../../../shared/users/validation'
import type { MutationCtx } from '../../_generated/server'
import type { Username } from '../../../shared/users/validation'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

type AuthUserDoc = {
  _id: string
  _creationTime: number
  email?: string | null
  name?: string | null
  image?: string | null
  emailVerified?: boolean | null
  twoFactorEnabled?: boolean | null
}

function getBaseUsername(user: AuthUserDoc): string {
  const idSuffix = String(user._id).slice(-8)
  return (
    (user.email ? user.email.split('@')[0] : undefined) ||
    user.name?.toLowerCase().replace(/\s+/g, '') ||
    `user-${idSuffix}`
  )
}

function getValidBaseUsername(user: AuthUserDoc): string {
  const idSuffix = String(user._id).slice(-8)
  const baseUsername = getBaseUsername(user)
  const fallbackUsername = idSuffix ? `user-${idSuffix}` : 'user'
  const normalized = normalizeUsernameCandidate(baseUsername, fallbackUsername)
  return parseUsername(normalized) !== null
    ? normalized
    : normalizeUsernameCandidate(`user-${normalized}`, fallbackUsername)
}

async function insertUserProfile(ctx: MutationCtx, user: AuthUserDoc, username: Username) {
  await ctx.db.insert('userProfiles', {
    userProfileUuid: generateDomainId(DOMAIN_ID_KIND.userProfile),
    authUserId: String(user._id),
    username,
    email: user.email ?? null,
    emailVerified: user.emailVerified ?? null,
    name: user.name ?? null,
    profileImage: user.image ? { type: 'external' as const, url: user.image } : null,
    twoFactorEnabled: user.twoFactorEnabled ?? null,
  })
}

export async function onCreateUser(ctx: MutationCtx, user: AuthUserDoc): Promise<void> {
  const baseUsername = getValidBaseUsername(user)
  const conflicts = new Set<string>()
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = deduplicateUsername(baseUsername, conflicts)
    const username = assertUsername(candidate)

    const conflict = await ctx.db
      .query('userProfiles')
      .withIndex('by_username', (q) => q.eq('username', candidate))
      .unique()
    if (!conflict) {
      await insertUserProfile(ctx, user, username)
      return
    }
    conflicts.add(candidate)
  }

  throw new Error(`Failed to find unique username for user ${user._id}`)
}
