import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createCanvas,
  createFile,
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
import { getPreviewLease } from '../previewLease'
import { storeUncommittedTestUploadSession } from '../../_test/storage.helper'

describe('setPreviewImage', () => {
  const t = createTestContext()

  it('sets preview on a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['test-preview']),
      'preview.png',
    )

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    const result = await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })
    expect(result).toEqual({ status: 'published' })

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(storageId)
      expect(note!.previewUpdatedAt).not.toBeNull()
      expect(Math.abs(now - note!.previewUpdatedAt!)).toBeLessThan(1000)
      expect(await getPreviewLease(dbCtx, noteId)).toBeNull()
      const uploadSession = await dbCtx.db.get('fileStorage', sessionId)
      expect(uploadSession?.status).toBe('committed')
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

    const { sessionId, storageId: newStorageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['new-preview']),
      'new-preview.png',
    )

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(newStorageId)

      const oldUrl = await dbCtx.storage.getUrl(oldStorageId)
      expect(oldUrl).toBeNull()
    })
  })

  it('keeps replaced preview storage when another content slot still references it', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    const oldStorageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['shared-preview-file']))
    })

    await t.run(async (dbCtx) => {
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      await dbCtx.db.patch('sidebarItems', noteId, { previewStorageId: oldStorageId })
      if (fileExt) await dbCtx.db.patch('files', fileExt._id, { storageId: oldStorageId })
    })

    const { sessionId, storageId: newStorageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['new-preview']),
      'new-preview.png',
    )

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      const oldUrl = await dbCtx.storage.getUrl(oldStorageId)

      expect(note!.previewStorageId).toBe(newStorageId)
      expect(fileExt?.storageId).toBe(oldStorageId)
      expect(oldUrl).not.toBeNull()
    })
  })

  it('player with edit share can set preview', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note!.previewStorageId).toBe(storageId)
    })
  })

  it("rejects another actor's upload session", async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    await expectNotFound(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: claimToken!,
      }),
    )
  })

  it('player with edit share can set a file preview', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: fileId },
    )

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: fileId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const file = await dbCtx.db.get('sidebarItems', fileId)
      expect(file!.previewStorageId).toBe(storageId)
    })
  })

  it('player with view share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('cannot set preview on folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        uploadSessionId: sessionId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('player with no share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
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

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('rejects wrong claim token', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectConflict(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: 'wrong-token',
      }),
    )
  })

  it('rejects publication as stale when content changes after the claim', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const claim = await dmAuth.mutation(api.sidebarItems.mutations.claimPreviewGeneration, {
      campaignId: ctx.campaignId,
      itemId: noteId,
    })
    if (claim.status !== 'claimed') throw new Error('Expected preview claim')

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      await dbCtx.db.patch('sidebarItems', noteId, {
        updatedTime: (note?.updatedTime ?? note?._creationTime ?? Date.now()) + 1,
      })
    })
    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['stale-preview']),
      'preview.png',
    )

    const result = await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      uploadSessionId: sessionId,
      claimToken: claim.claimToken,
    })

    expect(result).toEqual({ status: 'stale' })
    await t.run(async (dbCtx) => {
      expect((await dbCtx.db.get('sidebarItems', noteId))?.previewStorageId).toBeNull()
      expect((await dbCtx.db.get('fileStorage', sessionId))?.status).toBe('uncommitted')
    })
  })

  it('rejects expired claim', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    await t.run(async (dbCtx) => {
      const lease = await getPreviewLease(dbCtx, noteId)
      await dbCtx.db.patch('sidebarItemPreviewLeases', lease!._id, { lockedUntil: Date.now() - 1 })
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectConflict(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: claimToken!,
      }),
    )
  })

  it('sets preview on a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['test-preview']),
      'preview.png',
    )

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: canvasId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: canvasId,
      uploadSessionId: sessionId,
      claimToken: claimToken!,
    })

    await t.run(async (dbCtx) => {
      const now = Date.now()
      const canvas = await dbCtx.db.get('sidebarItems', canvasId)
      expect(canvas!.previewStorageId).toBe(storageId)
      expect(canvas!.previewUpdatedAt).not.toBeNull()
      expect(Math.abs(now - canvas!.previewUpdatedAt!)).toBeLessThan(1000)
      expect(await getPreviewLease(dbCtx, canvasId)).toBeNull()
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

    const { sessionId, storageId: newStorageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['new-preview']),
      'new-preview.png',
    )

    const { claimToken } = await dmAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: canvasId },
    )

    await dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: canvasId,
      uploadSessionId: sessionId,
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

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    const { claimToken } = await playerAuth.mutation(
      api.sidebarItems.mutations.claimPreviewGeneration,
      { campaignId: ctx.campaignId, itemId: canvasId },
    )

    await playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
      campaignId: ctx.campaignId,
      itemId: canvasId,
      uploadSessionId: sessionId,
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

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: canvasId,
      sidebarItemType: 'canvas',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: canvasId,
        uploadSessionId: sessionId,
        claimToken: 'fake-token',
      }),
    )
  })

  it('player with no share is denied for canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.player.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: canvasId,
        uploadSessionId: sessionId,
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

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: canvasId,
        uploadSessionId: sessionId,
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
      { campaignId: ctx.campaignId, itemId: noteId },
    )

    const { sessionId, storageId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['temp']),
      'preview.png',
    )
    await t.run(async (dbCtx) => {
      await dbCtx.storage.delete(storageId)
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: claimToken!,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const { sessionId } = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['preview']),
      'preview.png',
    )

    await expectNotAuthenticated(
      t.mutation(api.sidebarItems.mutations.setPreviewImage, {
        campaignId: ctx.campaignId,
        itemId: noteId,
        uploadSessionId: sessionId,
        claimToken: 'fake-token',
      }),
    )
  })
})
