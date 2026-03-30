import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createUserProfile } from '../../_test/factories.helper'
import {
  expectConflict,
  expectNotAuthenticated,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

async function setupAuthedUser(t: ReturnType<typeof createTestContext>) {
  const profile = await createUserProfile(t)
  const authed = t.withIdentity({ subject: profile.authUserId })
  return { authed, profile }
}

describe('getUserProfile', () => {
  const t = createTestContext()

  it('returns profile when authenticated', async () => {
    const { authed, profile } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.getUserProfile, {})

    expect(result).not.toBeNull()
    expect(result!._id).toBe(profile._id)
    expect(result!.username).toBe(profile.username)
    expect(result!.email).toBe(profile.email)
    expect(result!.name).toBe(profile.name)
  })

  it('returns null when unauthenticated', async () => {
    const result = await t.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })

  it('returns null when identity exists but no profile record', async () => {
    const orphan = t.withIdentity({ subject: 'ghost-user' })
    const result = await orphan.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })

  it('returns expected shape', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.getUserProfile, {})

    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('_creationTime')
    expect(result).toHaveProperty('authUserId')
    expect(result).toHaveProperty('username')
    expect(result).toHaveProperty('email')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('imageUrl')
    expect(result).toHaveProperty('imageStorageId')
    expect(result).toHaveProperty('twoFactorEnabled')
    expect(result).toHaveProperty('emailVerified')
  })
})

describe('checkUsernameExists', () => {
  const t = createTestContext()

  it('returns true for existing username', async () => {
    const { authed } = await setupAuthedUser(t)
    await createUserProfile(t, { username: 'taken-name' })

    const result = await authed.query(api.users.queries.checkUsernameExists, {
      username: 'taken-name',
    })

    expect(result).toBe(true)
  })

  it('returns false for nonexistent username', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.checkUsernameExists, {
      username: 'does-not-exist',
    })

    expect(result).toBe(false)
  })

  it('returns false for own username', async () => {
    const { authed, profile } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.checkUsernameExists, {
      username: profile.username,
    })

    expect(result).toBe(false)
  })

  it('throws NOT_AUTHENTICATED when unauthenticated', async () => {
    await expectNotAuthenticated(
      t.query(api.users.queries.checkUsernameExists, { username: 'test' }),
    )
  })
})

describe('updateUsername', () => {
  const t = createTestContext()

  it('lowercases and updates username', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: 'MyNewName',
    })

    expect(result).toBe('mynewname')

    const profile = await authed.query(api.users.queries.getUserProfile, {})
    expect(profile?.username).toBe('mynewname')
  })

  it('rejects username shorter than 2 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateUsername, { username: 'a' }),
    )
  })

  it('rejects username longer than 30 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    const longName = 'a'.repeat(31)
    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateUsername, {
        username: longName,
      }),
    )
  })

  it('accepts username at minimum boundary of 2 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: 'ab',
    })

    expect(result).toBe('ab')
  })

  it('accepts username at maximum boundary of 30 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    const name = 'a'.repeat(30)
    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: name,
    })

    expect(result).toBe(name)
  })

  it('rejects invalid characters', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateUsername, {
        username: 'user@name!',
      }),
    )
  })

  it('rejects duplicate username', async () => {
    const { authed } = await setupAuthedUser(t)
    await createUserProfile(t, { username: 'taken' })

    await expectConflict(
      authed.mutation(api.users.mutations.updateUsername, {
        username: 'taken',
      }),
    )
  })

  it('rejects duplicate username case-insensitively', async () => {
    const { authed } = await setupAuthedUser(t)
    await createUserProfile(t, { username: 'reserved' })

    await expectConflict(
      authed.mutation(api.users.mutations.updateUsername, {
        username: 'RESERVED',
      }),
    )
  })

  it('returns current username unchanged when input matches', async () => {
    const { authed, profile } = await setupAuthedUser(t)

    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: profile.username,
    })

    expect(result).toBe(profile.username)
  })

  it('throws NOT_AUTHENTICATED when unauthenticated', async () => {
    await expectNotAuthenticated(
      t.mutation(api.users.mutations.updateUsername, { username: 'test' }),
    )
  })
})

describe('updateName', () => {
  const t = createTestContext()

  it('updates name and trims whitespace', async () => {
    const { authed } = await setupAuthedUser(t)

    await authed.mutation(api.users.mutations.updateName, {
      name: '  New Name  ',
    })

    const updated = await authed.query(api.users.queries.getUserProfile, {})
    expect(updated!.name).toBe('New Name')
  })

  it('rejects empty name', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateName, { name: '' }),
    )
  })

  it('rejects whitespace-only name', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateName, { name: '   ' }),
    )
  })

  it('rejects name longer than 100 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateName, {
        name: 'a'.repeat(101),
      }),
    )
  })

  it('accepts name at maximum boundary of 100 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    const name = 'a'.repeat(100)
    await authed.mutation(api.users.mutations.updateName, { name })

    const updated = await authed.query(api.users.queries.getUserProfile, {})
    expect(updated!.name).toBe(name)
  })

  it('throws NOT_AUTHENTICATED when unauthenticated', async () => {
    await expectNotAuthenticated(
      t.mutation(api.users.mutations.updateName, { name: 'Test' }),
    )
  })
})

describe('updateProfileImage', () => {
  const t = createTestContext()

  it('throws NOT_AUTHENTICATED when unauthenticated', async () => {
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })

    await expectNotAuthenticated(
      t.mutation(api.users.mutations.updateProfileImage, { storageId }),
    )
  })

  it('updates profile image when authenticated', async () => {
    const { authed } = await setupAuthedUser(t)
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(['test']))
    })

    await authed.mutation(api.users.mutations.updateProfileImage, { storageId })

    const updated = await authed.query(api.users.queries.getUserProfile, {})
    expect(updated!.imageStorageId).toBe(storageId)
  })
})
