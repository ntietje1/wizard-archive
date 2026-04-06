import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
} from '../../_test/identities.helper'
import {
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { COOLDOWN_MS } from '../functions/claimPreviewGeneration'

describe('claimPreviewGeneration', () => {
  const t = createTestContext()

  it('DM can claim for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    expect(result.claimed).toBe(true)

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get(noteId)
      expect(note!.previewLockedUntil).not.toBeNull()
      expect(note!.previewLockedUntil).toBeGreaterThan(now)
    })
  })

  it('returns false for folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
    )

    const result = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: folderId },
    )

    expect(result.claimed).toBe(false)
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

    const result = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )

    expect(result.claimed).toBe(true)
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
      await dbCtx.db.delete(noteId)
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

    const first = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )
    expect(first.claimed).toBe(true)

    const second = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )
    expect(second.claimed).toBe(false)
  })

  it('returns true when lock has expired', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        previewLockedUntil: Date.now() - 1,
      })
    })

    const result = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )
    expect(result.claimed).toBe(true)
  })

  it('returns false during cooldown period', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        previewUpdatedAt: Date.now() - 1000,
      })
    })

    const result = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )
    expect(result.claimed).toBe(false)
  })

  it('returns true after cooldown expires', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        previewUpdatedAt: Date.now() - COOLDOWN_MS - 1,
      })
    })

    const result = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { itemId: noteId },
    )
    expect(result.claimed).toBe(true)
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

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        previewLockedUntil: Date.now() + 60_000,
      })
    })

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: storageId,
    })

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get(noteId)
      expect(note!.previewStorageId).toBe(storageId)
      expect(note!.previewUpdatedAt).not.toBeNull()
      expect(Math.abs(now - note!.previewUpdatedAt!)).toBeLessThan(5000)
      expect(note!.previewLockedUntil).toBeNull()
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
      await dbCtx.db.patch(noteId, { previewStorageId: oldStorageId })
    })

    const newStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['new-preview']))
    })

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: newStorageId,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
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

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      itemId: noteId,
      previewStorageId: storageId,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
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
      }),
    )
  })

  it('throws NOT_FOUND for nonexistent item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete(noteId)
    })

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        itemId: noteId,
        previewStorageId: storageId,
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
      await dbCtx.db.patch(noteId, { previewStorageId: storageId })
    })

    const items = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId: ctx.campaignId, location: 'sidebar' },
    )

    const note = items.find((i) => i._id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).not.toBeNull()
    expect(typeof note!.previewUrl).toBe('string')
  })

  it('returns null previewUrl when previewStorageId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId: ctx.campaignId, location: 'sidebar' },
    )

    const note = items.find((i) => i._id === noteId)
    expect(note).toBeDefined()
    expect(note!.previewUrl).toBeNull()
  })
})
