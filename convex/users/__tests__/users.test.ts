import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createUserProfile } from '../../_test/factories.helper'
import { testAuthIdentity, testAuthIdentityForKey } from '../../_test/identities.helper'
import {
  expectConflict,
  expectNotAuthenticated,
  expectNotFound,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import {
  storeCommittedTestUploadSession,
  storeUncommittedTestUploadSession,
} from '../../_test/storage.helper'

async function setupAuthedUser(t: ReturnType<typeof createTestContext>) {
  const profile = await createUserProfile(t)
  const authed = t.withIdentity(testAuthIdentity(profile))
  return { authed, profile }
}

describe('getUserProfile', () => {
  const t = createTestContext()

  it('returns profile when authenticated', async () => {
    const { authed, profile } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.getUserProfile, {})

    expect(result).not.toBeNull()
    expect(result!.id).toBe(profile.userProfileUuid)
    expect(result!.username).toBe(profile.username)
    expect(result!.email).toBe(profile.email)
    expect(result!.name).toBe(profile.name)
  })

  it('returns null when unauthenticated', async () => {
    const result = await t.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })

  it('returns null when identity exists but no profile record', async () => {
    const orphan = t.withIdentity(testAuthIdentityForKey('ghost-user'))
    const result = await orphan.query(api.users.queries.getUserProfile, {})
    expect(result).toBeNull()
  })

  it('returns expected shape', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.query(api.users.queries.getUserProfile, {})

    expect(result).toHaveProperty('id')
    expect(result).toHaveProperty('createdAt')
    expect(result).not.toHaveProperty('authUserId')
    expect(result).toHaveProperty('username')
    expect(result).toHaveProperty('email')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('imageUrl')
    expect(result).toHaveProperty('twoFactorEnabled')
    expect(result).toHaveProperty('emailVerified')
    expect(result).not.toHaveProperty('profileImage')
    expect(result).not.toHaveProperty('imageStorageId')
  })

  it('allows existing short usernames to be read', async () => {
    const { authed, profile } = await setupAuthedUser(t)
    await t.run(async (ctx) => {
      await ctx.db.patch('userProfiles', profile._id, { username: 'abc' })
    })

    const result = await authed.query(api.users.queries.getUserProfile, {})

    expect(result?.username).toBe('abc')
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

  it('updates a canonical username', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: 'mynewname',
    })

    expect(result).toBe('mynewname')

    const profile = await authed.query(api.users.queries.getUserProfile, {})
    expect(profile?.username).toBe('mynewname')
  })

  it('rejects username shorter than 4 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateUsername, { username: 'abc' }),
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

  it('accepts username at minimum boundary of 4 characters', async () => {
    const { authed } = await setupAuthedUser(t)

    const result = await authed.mutation(api.users.mutations.updateUsername, {
      username: 'abcd',
    })

    expect(result).toBe('abcd')
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

  it('rejects uppercase usernames', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(
      authed.mutation(api.users.mutations.updateUsername, {
        username: 'MyNewName',
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

  it('rejects uppercase usernames before duplicate checks', async () => {
    const { authed } = await setupAuthedUser(t)
    await createUserProfile(t, { username: 'reserved' })

    await expectValidationFailed(
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

    await expectValidationFailed(authed.mutation(api.users.mutations.updateName, { name: '' }))
  })

  it('rejects whitespace-only name', async () => {
    const { authed } = await setupAuthedUser(t)

    await expectValidationFailed(authed.mutation(api.users.mutations.updateName, { name: '   ' }))
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
    await expectNotAuthenticated(t.mutation(api.users.mutations.updateName, { name: 'Test' }))
  })
})

describe('updateProfileImage', () => {
  const t = createTestContext()

  it('throws NOT_AUTHENTICATED when unauthenticated', async () => {
    const { profile } = await setupAuthedUser(t)
    const upload = await storeCommittedTestUploadSession(
      t,
      profile._id,
      new Blob(['test']),
      'profile.png',
    )

    await expectNotAuthenticated(
      t.mutation(api.users.mutations.updateProfileImage, {
        uploadSessionId: upload.sessionId,
      }),
    )
  })

  it('updates profile image when authenticated', async () => {
    const { authed, profile } = await setupAuthedUser(t)
    const upload = await storeUncommittedTestUploadSession(
      t,
      profile._id,
      new Blob(['test']),
      'profile.png',
    )

    await authed.mutation(api.users.mutations.updateProfileImage, {
      uploadSessionId: upload.sessionId,
    })

    const updated = await authed.query(api.users.queries.getUserProfile, {})
    expect(updated!.imageUrl).toEqual(expect.any(String))
    await t.run(async (ctx) => {
      await expect(ctx.db.get('fileStorage', upload.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
    })
  })

  it("rejects another actor's upload session", async () => {
    const { authed } = await setupAuthedUser(t)
    const other = await setupAuthedUser(t)
    const upload = await storeUncommittedTestUploadSession(
      t,
      other.profile._id,
      new Blob(['test']),
      'profile.png',
    )

    await expectNotFound(
      authed.mutation(api.users.mutations.updateProfileImage, {
        uploadSessionId: upload.sessionId,
      }),
    )
  })
})
