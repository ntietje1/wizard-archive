import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  addPlayerToCampaign,
  createCampaignWithDm,
  createUserProfile,
} from '../../_test/factories.helper'
import { setupUser, testAuthIdentity, testAuthIdentityForKey } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { onCreateUser } from '../functions/onCreateUser'
import { onDeleteUser } from '../functions/onDeleteUser'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'
import { api } from '../../_generated/api'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

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

describe('onDeleteUser', () => {
  const t = createTestContext()

  it("retires a DM campaign and removes the deleted user's membership", async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    const { memberId: playerMemberId } = await addPlayerToCampaign(t, campaignId, player.profile)

    await t.run(async (ctx) => {
      await onDeleteUser(ctx, {
        _id: dm.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get('campaigns', campaignId)).toMatchObject({ status: 'Deleted' })
      expect(await ctx.db.get('campaignMembers', playerMemberId)).toMatchObject({
        status: 'Accepted',
      })
      expect(await ctx.db.get('userProfiles', dm.profile._id)).toBeNull()
    })
  })

  it('removes a player membership without retiring the campaign', async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)
    const { campaignId, dmMemberId } = await createCampaignWithDm(t, dm.profile)
    const { memberId: playerMemberId } = await addPlayerToCampaign(t, campaignId, player.profile)

    await t.run(async (ctx) => {
      await onDeleteUser(ctx, {
        _id: player.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get('campaigns', campaignId)).toMatchObject({ status: 'Active' })
      expect(await ctx.db.get('campaignMembers', dmMemberId)).toMatchObject({ status: 'Accepted' })
      expect(await ctx.db.get('campaignMembers', playerMemberId)).toMatchObject({
        status: 'Removed',
      })
      expect(await ctx.db.get('userProfiles', player.profile._id)).toBeNull()
    })
  })

  it('retains resource-owned assets and deletes unowned uploads', async () => {
    const user = await setupUser(t)
    const owner = await setupUser(t)
    const { campaignDomainId } = await createCampaignWithDm(t, owner.profile)
    const owned = await storeCommittedTestUploadSession(
      t,
      user.profile._id,
      new Blob(['owned']),
      'owned.txt',
    )
    const unowned = await storeCommittedTestUploadSession(
      t,
      user.profile._id,
      new Blob(['unowned']),
      'unowned.txt',
    )

    await t.run(async (ctx) => {
      await ctx.db.insert('resourceAssetOwners', {
        campaignUuid: campaignDomainId,
        resourceUuid: generateDomainId(DOMAIN_ID_KIND.resource),
        assetUuid: owned.assetId,
      })
      await onDeleteUser(ctx, {
        _id: user.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    await t.run(async (ctx) => {
      expect(await ctx.db.get('fileStorage', owned.sessionId)).not.toBeNull()
      expect(await ctx.storage.get(owned.storageId)).not.toBeNull()
      expect(await ctx.db.get('fileStorage', unowned.sessionId)).toBeNull()
      expect(await ctx.storage.get(unowned.storageId)).toBeNull()
    })
  })
})
