import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createUserProfile } from '../../_test/factories.helper'
import { testAuthIdentity, testAuthIdentityForKey } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { onCreateUser } from '../functions/onCreateUser'
import { api } from '../../_generated/api'

async function getProfileByAuthUserId(t: ReturnType<typeof createTestContext>, authUserId: string) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query('userProfiles')
      .withIndex('by_user', (q) => q.eq('authUserId', authUserId))
      .unique()
  })
}

describe('onCreateUser', () => {
  const t = createTestContext()

  it('generates username from email prefix', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-1',
        _creationTime: Date.now(),
        email: 'alice@example.com',
        name: 'Alice',
        emailVerified: true,
      })
    })

    const profile = await getProfileByAuthUserId(t, 'auth-1')

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('alice')
  })

  it('falls back to name if no email', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-2',
        _creationTime: Date.now(),
        email: '',
        name: 'Bob Smith',
        emailVerified: false,
      })
    })

    const profile = await getProfileByAuthUserId(t, 'auth-2')

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('bobsmith')
  })

  it('falls back to a valid user id suffix if neither email nor name exists', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-abcd1234',
        _creationTime: Date.now(),
        email: '',
        name: '',
        emailVerified: false,
      })
    })

    const profile = await getProfileByAuthUserId(t, 'auth-abcd1234')

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('user-abcd1234')
  })

  it('keeps generated usernames valid when the email prefix is too short', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-short',
        _creationTime: Date.now(),
        email: 'abc@example.com',
        name: 'Abc',
        emailVerified: true,
      })
    })

    const profile = await getProfileByAuthUserId(t, 'auth-short')

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('user-abc')
  })

  it('deduplicates username on conflict', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-dedup-first',
        _creationTime: Date.now(),
        email: 'dedup@example.com',
        name: 'Dedup',
        emailVerified: true,
      })
    })

    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-dedup-second',
        _creationTime: Date.now(),
        email: 'dedup@other.com',
        name: 'Dedup Two',
        emailVerified: true,
      })
    })

    const first = await getProfileByAuthUserId(t, 'auth-dedup-first')
    const second = await getProfileByAuthUserId(t, 'auth-dedup-second')

    expect(first!.username).toBe('dedup')
    expect(second!.username).toBe('dedup-1')
  })

  it('creates full userProfile with all fields', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-full',
        _creationTime: Date.now(),
        email: 'full@example.com',
        name: 'Full User',
        emailVerified: true,
        image: 'https://example.com/avatar.png',
        twoFactorEnabled: true,
      })
    })

    const profile = await getProfileByAuthUserId(t, 'auth-full')

    expect(profile).not.toBeNull()
    expect(profile!.authUserId).toBe('auth-full')
    expect(profile!.username).toBe('full')
    expect(profile!.email).toBe('full@example.com')
    expect(profile!.emailVerified).toBe(true)
    expect(profile!.name).toBe('Full User')
    expect(profile!.profileImage).toEqual({
      type: 'external',
      url: 'https://example.com/avatar.png',
    })
    expect(profile!.twoFactorEnabled).toBe(true)
  })
})

describe('authenticate edge cases', () => {
  const t = createTestContext()

  it('uses the Better Auth user id as the profile lookup key', async () => {
    const profile = await createUserProfile(t)
    const identity = t.withIdentity({
      ...testAuthIdentity(profile),
      tokenIdentifier: 'different-stable-token-identifier',
    })

    const result = await identity.query(api.users.queries.checkUsernameExists, {
      username: 'available-name',
    })

    expect(result).toBe(false)
  })

  it('throws NOT_AUTHENTICATED when identity exists but no profile record', async () => {
    const orphanIdentity = t.withIdentity(testAuthIdentityForKey('nonexistent-auth-id'))
    await expectNotAuthenticated(
      orphanIdentity.query(api.users.queries.checkUsernameExists, {
        username: 'anything',
      }),
    )
  })

  it('returns null for getUserProfile when completely unauthenticated', async () => {
    const result = await t.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })

  it('returns null for getUserProfile when identity exists but no profile', async () => {
    const orphan = t.withIdentity(testAuthIdentityForKey('no-profile-auth-id'))
    const result = await orphan.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })
})
