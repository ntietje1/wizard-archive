import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  addPlayerToCampaign,
  createBlock,
  createBlockShare,
  createCampaignWithDm,
  createFile,
  createGameMap,
  createNote,
  createSidebarShare,
  createUserProfile,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { setupUser, testAuthIdentity, testAuthIdentityForKey } from '../../_test/identities.helper'
import { expectNotAuthenticated } from '../../_test/assertions.helper'
import { onCreateUser } from '../functions/onCreateUser'
import { onDeleteUser } from '../functions/onDeleteUser'
import { storeCommittedTestUpload } from '../../_test/storage.helper'
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

describe('onDeleteUser', () => {
  const t = createTestContext()

  it("retires DM-owned campaigns and removes the deleted user's campaign state", async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)
    const { campaignId, campaignDomainId, dmMemberId } = await createCampaignWithDm(t, dm.profile)
    const { memberId: playerMemberId } = await addPlayerToCampaign(t, campaignId, player.profile)
    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('account-delete-shared-block'),
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: dmMemberId,
    })
    const { blockShareId } = await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: dmMemberId,
    })

    await dm.authed.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: campaignDomainId,
    })

    await t.run(async (ctx) => {
      await onDeleteUser(ctx, {
        _id: dm.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    const result = await t.run(async (ctx) => {
      return {
        campaign: await ctx.db.get('campaigns', campaignId),
        dmMember: await ctx.db.get('campaignMembers', dmMemberId),
        playerMember: await ctx.db.get('campaignMembers', playerMemberId),
        sidebarShare: await ctx.db.get('sidebarItemShares', shareId),
        blockShare: await ctx.db.get('blockShares', blockShareId),
        editors: await ctx.db
          .query('editor')
          .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
          .collect(),
      }
    })

    expect(result.campaign).toMatchObject({ status: 'Deleted' })
    expect(result.dmMember).toMatchObject({ status: 'Removed' })
    expect(result.playerMember).toMatchObject({ status: 'Accepted' })
    expect(result.sidebarShare).toBeNull()
    expect(result.blockShare).toBeNull()
    expect(result.editors).toHaveLength(0)
  })

  it('removes player campaign state without retiring the campaign', async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)
    const { campaignId, campaignDomainId, dmMemberId } = await createCampaignWithDm(t, dm.profile)
    const { memberId: playerMemberId } = await addPlayerToCampaign(t, campaignId, player.profile)
    const { noteId } = await createNote(t, campaignId, dm.profile._id)
    const { blockDbId } = await createBlock(t, noteId, campaignId, {
      blockNoteId: testBlockNoteId('player-account-delete-shared-block'),
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: playerMemberId,
    })
    const { blockShareId } = await createBlockShare(t, {
      campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: playerMemberId,
    })

    await player.authed.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: campaignDomainId,
    })

    await t.run(async (ctx) => {
      await onDeleteUser(ctx, {
        _id: player.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    const result = await t.run(async (ctx) => {
      return {
        campaign: await ctx.db.get('campaigns', campaignId),
        dmMember: await ctx.db.get('campaignMembers', dmMemberId),
        playerMember: await ctx.db.get('campaignMembers', playerMemberId),
        sidebarShare: await ctx.db.get('sidebarItemShares', shareId),
        blockShare: await ctx.db.get('blockShares', blockShareId),
        editors: await ctx.db
          .query('editor')
          .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
          .collect(),
      }
    })

    expect(result.campaign).toMatchObject({ status: 'Active' })
    expect(result.dmMember).toMatchObject({ status: 'Accepted' })
    expect(result.playerMember).toMatchObject({ status: 'Removed' })
    expect(result.sidebarShare).toBeNull()
    expect(result.blockShare).toBeNull()
    expect(result.editors).toHaveLength(0)
  })

  it('keeps committed campaign storage when deleting the uploader account', async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)
    const { campaignId } = await createCampaignWithDm(t, dm.profile)
    await addPlayerToCampaign(t, campaignId, player.profile)

    const [fileStorageId, mapStorageId, previewStorageId] = await Promise.all([
      storeCommittedTestUpload(t, player.profile._id, new Blob(['file']), 'file.txt'),
      storeCommittedTestUpload(t, player.profile._id, new Blob(['map']), 'map.png'),
      storeCommittedTestUpload(t, player.profile._id, new Blob(['preview']), 'preview.png'),
    ])

    const { fileId } = await createFile(t, campaignId, dm.profile._id, {
      storageId: fileStorageId,
    })
    const { mapId } = await createGameMap(t, campaignId, dm.profile._id, {
      imageStorageId: mapStorageId,
    })
    const { noteId } = await createNote(t, campaignId, dm.profile._id, {
      previewStorageId,
    })

    await t.run(async (ctx) => {
      await onDeleteUser(ctx, {
        _id: player.profile.authUserId,
        _creationTime: Date.now(),
      })
    })

    const result = await t.run(async (ctx) => {
      const remainingUploadRows = await ctx.db
        .query('fileStorage')
        .withIndex('by_user_storage', (q) => q.eq('userId', player.profile._id))
        .collect()
      const file = await ctx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      const map = await ctx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      const note = await ctx.db.get('sidebarItems', noteId)

      return {
        file,
        fileUrl: await ctx.storage.getUrl(fileStorageId),
        map,
        mapUrl: await ctx.storage.getUrl(mapStorageId),
        note,
        previewUrl: await ctx.storage.getUrl(previewStorageId),
        remainingUploadRows,
      }
    })

    expect(result.remainingUploadRows).toHaveLength(0)
    expect(result.file?.storageId).toBe(fileStorageId)
    expect(result.map?.imageStorageId).toBe(mapStorageId)
    expect(result.note?.previewStorageId).toBe(previewStorageId)
    expect(result.fileUrl).not.toBeNull()
    expect(result.mapUrl).not.toBeNull()
    expect(result.previewUrl).not.toBeNull()
  })
})
