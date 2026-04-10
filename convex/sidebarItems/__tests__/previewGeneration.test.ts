import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createCanvas,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import {
  expectConflict,
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { COOLDOWN_MS } from '../functions/claimPreviewGeneration'

describe('claimPreviewGeneration', () => {
  const t = createTestContext()

  it('DM can claim for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewLockedUntil).not.toBeNull()
      expect(note!.previewLockedUntil).toBeGreaterThan(now)
      expect(note!.previewClaimToken).toBe(result.claimToken)
    })
  })

  it('returns false for folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: folderId,
    })

    expect(result.claimed).toBe(false)
    expect(result.claimToken).toBeNull()
  })

  it('player with edit share can claim', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')
  })

  it('player with view share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: noteId,
      }),
    )
  })

  it('player with no share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: noteId,
      }),
    )
  })

  it('throws NOT_FOUND for nonexistent item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteId)
    })

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: noteId,
      }),
    )
  })

  it('returns false when lock is active', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const first = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })
    expect(first.claimed).toBe(true)

    const second = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })
    expect(second.claimed).toBe(false)
    expect(second.claimToken).toBeNull()
  })

  it('returns true when lock has expired', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewLockedUntil: Date.now() - 1,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })
    expect(result.claimed).toBe(true)
  })

  it('returns false during cooldown period', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: Date.now() - COOLDOWN_MS / 2,
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })
    expect(result.claimed).toBe(false)
    expect(result.claimToken).toBeNull()
  })

  it('returns true after cooldown expires', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        previewUpdatedAt: Date.now() - (COOLDOWN_MS + 1),
      })
    })

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })
    expect(result.claimed).toBe(true)
  })

  it('DM can claim for a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: canvasId,
    })

    expect(result.claimed).toBe(true)
    expect(typeof result.claimToken).toBe('string')

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewLockedUntil).not.toBeNull()
      expect(canvas!.previewLockedUntil).toBeGreaterThan(now)
      expect(canvas!.previewClaimToken).toBe(result.claimToken)
    })
  })

  it('player with edit share can claim canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: canvasId,
    })

    expect(result.claimed).toBe(true)
  })

  it('player with view share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: canvasId,
      }),
    )
  })

  it('player with no share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: canvasId,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
        itemId: noteId,
      }),
    )
  })
})

describe('setPreviewImage', () => {
  const t = createTestContext()

  it('sets preview on a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['test-preview']))
    })

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: storageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(storageId)
      expect(note!.previewUpdatedAt).not.toBeNull()
      expect(Math.abs(now - note!.previewUpdatedAt!)).toBeLessThan(1000)
      expect(note!.previewLockedUntil).toBeNull()
      expect(note!.previewClaimToken).toBeNull()
    })
  })

  it('replaces existing preview and deletes old blob', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const oldStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['old-preview']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, { previewStorageId: oldStorageId })
    })

    const newStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['new-preview']))
    })

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: newStorageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(newStorageId)

      const oldUrl = await dbCtx.storage.getUrl(oldStorageId)
      expect(oldUrl).toBeNull()
    })
  })

  it('player with edit share can set preview', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: storageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(storageId)
    })
  })

  it('player with view share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('cannot set preview on folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: folderId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('player with no share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('throws NOT_FOUND for nonexistent item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteId)
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('rejects wrong claim token', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      itemId: noteId,
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectConflict(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: 'wrong-token',
      }),
    )
  })

  it('rejects expired claim', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, { previewLockedUntil: Date.now() - 1 })
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectConflict(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: claimToken!,
      }),
    )
  })

  it('sets preview on a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['test-preview']))
    })

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: canvasId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: canvasId,
      previewStorageId: storageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewStorageId).toBe(storageId)
      expect(canvas!.previewUpdatedAt).not.toBeNull()
      expect(Math.abs(now - canvas!.previewUpdatedAt!)).toBeLessThan(1000)
      expect(canvas!.previewLockedUntil).toBeNull()
      expect(canvas!.previewClaimToken).toBeNull()
    })
  })

  it('replaces existing canvas preview and deletes old blob', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const oldStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['old-preview']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', canvasId, { previewStorageId: oldStorageId })
    })

    const newStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['new-preview']))
    })

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: canvasId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: canvasId,
      previewStorageId: newStorageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewStorageId).toBe(newStorageId)

      const oldUrl = await dbCtx.storage.getUrl(oldStorageId)
      expect(oldUrl).toBeNull()
    })
  })

  it('player with edit share can set canvas preview', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: canvasId },
    )

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: canvasId,
      previewStorageId: storageId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewStorageId).toBe(storageId)
    })
  })

  it('player with view share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: canvasId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('player with no share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: canvasId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('throws NOT_FOUND for nonexistent canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', canvasId)
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: canvasId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('rejects nonexistent storage id', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    const deletedStorageId = await t.run(async (dbCtx) => {
      const id = await dbCtx.storage.store(new Blob(['temp']))
      await dbCtx.storage.delete(id)
      return id
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: deletedStorageId,
        claimToken: claimToken!,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectNotAuthenticated(
      t.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
        claimToken: 'fake-token',
      }),
    )
  })
})

describe('enhanceBase previewUrl resolution', () => {
  const t = createTestContext()

  it('returns previewUrl when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview-data']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, { previewStorageId: storageId })
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    const note = items.find((i) => i._id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).not.toBeNull()
    expect(typeof note!.previewUrl).toBe('string')
  })

  it('returns previewUrl for canvas when previewStorageId is set', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['canvas-preview']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', canvasId, { previewStorageId: storageId })
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    const canvas = items.find((i) => i._id === canvasId)
    expect(canvas).toBeDefined()
    expect(canvas!.previewUrl).not.toBeNull()
    expect(typeof canvas!.previewUrl).toBe('string')
  })

  it('returns null previewUrl for canvas when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    const canvas = items.find((i) => i._id === canvasId)
    expect(canvas).toBeDefined()
    expect(canvas!.previewUrl).toBeNull()
  })

  it('returns null previewUrl when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    const note = items.find((i) => i._id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).toBeNull()
  })
})
