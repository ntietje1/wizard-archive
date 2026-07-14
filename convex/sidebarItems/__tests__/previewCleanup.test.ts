import { describe, expect, it } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeDeleteForeverCommand,
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../_test/factories.helper'
import type { TestConvex } from 'convex-test'
import type schema from '../../schema'
import type { Id } from '../../_generated/dataModel'
import { getPreviewLease } from '../previewLease'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'

async function trashItem(
  t: TestConvex<typeof schema>,
  itemId: Id<'sidebarItems'>,
  deletedBy: Id<'userProfiles'>,
  patches?: Record<string, unknown>,
) {
  await t.run(async (dbCtx) => {
    await dbCtx.db.patch('sidebarItems', itemId, {
      ...patches,
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy,
    })
  })
}

async function storeTestAsset(
  t: TestConvex<typeof schema>,
  userId: Id<'userProfiles'>,
  contents: string,
) {
  return (await storeCommittedTestUploadSession(t, userId, new Blob([contents]), 'asset.bin'))
    .storageId
}

describe('preview cleanup on hard delete', () => {
  const t = createTestContext()

  it('deleting a note cleans up its preview storage and lease', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('sidebarItemPreviewLeases', {
        sidebarItemId: noteId,
        claimToken: 'claim',
        lockedUntil: Date.now() + 1000,
      })
    })
    const storageId = await storeTestAsset(t, ctx.dm.profile._id, 'preview')

    await trashItem(t, noteId, ctx.dm.profile._id, {
      previewStorageId: storageId,
    })

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note).toBeNull()
      expect(await getPreviewLease(dbCtx, noteId)).toBeNull()

      const url = await dbCtx.storage.getUrl(storageId)
      expect(url).toBeNull()
    })
  })

  it('deleting a file cleans up both storageId and previewStorageId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const fileBlob = await storeTestAsset(t, ctx.dm.profile._id, 'file-content')
    const previewBlob = await storeTestAsset(t, ctx.dm.profile._id, 'preview-content')

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const ext = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      if (ext) await dbCtx.db.patch('files', ext._id, { storageId: fileBlob })
    })
    await trashItem(t, fileId, ctx.dm.profile._id, {
      previewStorageId: previewBlob,
    })

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId],
    })

    await t.run(async (dbCtx) => {
      const file = await dbCtx.db.get('sidebarItems', fileId)
      expect(file).toBeNull()

      const fileUrl = await dbCtx.storage.getUrl(fileBlob)
      const previewUrl = await dbCtx.storage.getUrl(previewBlob)
      expect(fileUrl).toBeNull()
      expect(previewUrl).toBeNull()
    })
  })

  it('deleting a file keeps storage that is still used as a map image', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sharedBlob = await storeTestAsset(t, ctx.dm.profile._id, 'shared-file-map')

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      const mapExt = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      if (fileExt) await dbCtx.db.patch('files', fileExt._id, { storageId: sharedBlob })
      if (mapExt) await dbCtx.db.patch('gameMaps', mapExt._id, { imageStorageId: sharedBlob })
    })
    await trashItem(t, fileId, ctx.dm.profile._id)

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [fileId],
    })

    await t.run(async (dbCtx) => {
      const file = await dbCtx.db.get('sidebarItems', fileId)
      const mapExt = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      const url = await dbCtx.storage.getUrl(sharedBlob)

      expect(file).toBeNull()
      expect(mapExt?.imageStorageId).toBe(sharedBlob)
      expect(url).not.toBeNull()
    })
  })

  it('deleting a gameMap where previewStorageId === imageStorageId does not error', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sharedBlob = await storeTestAsset(t, ctx.dm.profile._id, 'map-image')

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const ext = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      if (ext) await dbCtx.db.patch('gameMaps', ext._id, { imageStorageId: sharedBlob })
    })
    await trashItem(t, mapId, ctx.dm.profile._id, {
      previewStorageId: sharedBlob,
    })

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [mapId],
    })

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      expect(map).toBeNull()

      const url = await dbCtx.storage.getUrl(sharedBlob)
      expect(url).toBeNull()
    })
  })

  it('deleting a gameMap where previewStorageId !== imageStorageId cleans up both', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const imageBlob = await storeTestAsset(t, ctx.dm.profile._id, 'map-image')
    const previewBlob = await storeTestAsset(t, ctx.dm.profile._id, 'map-preview')

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const ext = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      if (ext) await dbCtx.db.patch('gameMaps', ext._id, { imageStorageId: imageBlob })
    })
    await trashItem(t, mapId, ctx.dm.profile._id, {
      previewStorageId: previewBlob,
    })

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [mapId],
    })

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      expect(map).toBeNull()

      const imageUrl = await dbCtx.storage.getUrl(imageBlob)
      const previewUrl = await dbCtx.storage.getUrl(previewBlob)
      expect(imageUrl).toBeNull()
      expect(previewUrl).toBeNull()
    })
  })

  it('deleting a gameMap keeps storage that is still used as file content and a preview', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sharedBlob = await storeTestAsset(t, ctx.dm.profile._id, 'shared-map-file-preview')

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      previewStorageId: sharedBlob,
    })

    await t.run(async (dbCtx) => {
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      const mapExt = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .unique()
      if (fileExt) await dbCtx.db.patch('files', fileExt._id, { storageId: sharedBlob })
      if (mapExt) await dbCtx.db.patch('gameMaps', mapExt._id, { imageStorageId: sharedBlob })
    })
    await trashItem(t, mapId, ctx.dm.profile._id)

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [mapId],
    })

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      const fileExt = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
        .unique()
      const note = await dbCtx.db.get('sidebarItems', noteId)
      const url = await dbCtx.storage.getUrl(sharedBlob)

      expect(map).toBeNull()
      expect(fileExt?.storageId).toBe(sharedBlob)
      expect(note?.previewStorageId).toBe(sharedBlob)
      expect(url).not.toBeNull()
    })
  })

  it('deleting item with null previewStorageId works fine', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await trashItem(t, noteId, ctx.dm.profile._id)

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
    })

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get('sidebarItems', noteId)
      expect(note).toBeNull()
    })
  })

  it('deleting a folder with no preview works fine', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    await trashItem(t, folderId, ctx.dm.profile._id)

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get('sidebarItems', folderId)
      expect(folder).toBeNull()
    })
  })
})
