import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { onCreateUser } from '../functions/onCreateUser'
import { api } from '../../_generated/api'

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

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-1'))
        .unique()
    })

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

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-2'))
        .unique()
    })

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('bobsmith')
  })

  it('falls back to user{id-suffix} if neither email nor name', async () => {
    await t.run(async (ctx) => {
      await onCreateUser(ctx, {
        _id: 'auth-abcd1234',
        _creationTime: Date.now(),
        email: '',
        name: '',
        emailVerified: false,
      })
    })

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-abcd1234'))
        .unique()
    })

    expect(profile).not.toBeNull()
    expect(profile!.username).toBe('userabcd1234')
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

    const first = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-dedup-first'))
        .unique()
    })
    const second = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-dedup-second'))
        .unique()
    })

    expect(first!.username).toBe('dedup')
    expect(second!.username).toBe('dedup-2')
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

    const profile = await t.run(async (ctx) => {
      return await ctx.db
        .query('userProfiles')
        .withIndex('by_user', (q) => q.eq('authUserId', 'auth-full'))
        .unique()
    })

    expect(profile).not.toBeNull()
    expect(profile!.authUserId).toBe('auth-full')
    expect(profile!.username).toBe('full')
    expect(profile!.email).toBe('full@example.com')
    expect(profile!.emailVerified).toBe(true)
    expect(profile!.name).toBe('Full User')
    expect(profile!.imageUrl).toBe('https://example.com/avatar.png')
    expect(profile!.imageStorageId).toBeNull()
    expect(profile!.twoFactorEnabled).toBe(true)
  })
})

describe('authenticate edge cases', () => {
  const t = createTestContext()

  it('throws NOT_AUTHENTICATED when identity exists but no profile record', async () => {
    const orphanIdentity = t.withIdentity({ subject: 'nonexistent-auth-id' })
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
    const orphan = t.withIdentity({ subject: 'no-profile-auth-id' })
    const result = await orphan.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })
})
