import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
} from '../../_test/factories.helper'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { api } from '../../_generated/api'

describe('preview cleanup on hard delete', () => {
  const t = createTestContext()

  it('deleting a note with preview cleans up storage blob', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview']))
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        previewStorageId: storageId,
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: noteId },
    )

    await t.run(async (dbCtx) => {
      const url = await dbCtx.storage.getUrl(storageId)
      expect(url).toBeNull()
    })
  })

  it('deleting a file cleans up both storageId and previewStorageId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const fileBlob = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['file-content']))
    })
    const previewBlob = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['preview-content']))
    })

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(fileId, {
        storageId: fileBlob,
        previewStorageId: previewBlob,
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: fileId },
    )

    await t.run(async (dbCtx) => {
      const fileUrl = await dbCtx.storage.getUrl(fileBlob)
      const previewUrl = await dbCtx.storage.getUrl(previewBlob)
      expect(fileUrl).toBeNull()
      expect(previewUrl).toBeNull()
    })
  })

  it('deleting a gameMap where previewStorageId === imageStorageId does not error', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const sharedBlob = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['map-image']))
    })

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(mapId, {
        imageStorageId: sharedBlob,
        previewStorageId: sharedBlob,
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: mapId },
    )

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get(mapId)
      expect(map).toBeNull()

      const url = await dbCtx.storage.getUrl(sharedBlob)
      expect(url).toBeNull()
    })
  })

  it('deleting a gameMap where previewStorageId !== imageStorageId cleans up both', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const imageBlob = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['map-image']))
    })
    const previewBlob = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['map-preview']))
    })

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(mapId, {
        imageStorageId: imageBlob,
        previewStorageId: previewBlob,
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: mapId },
    )

    await t.run(async (dbCtx) => {
      const imageUrl = await dbCtx.storage.getUrl(imageBlob)
      const previewUrl = await dbCtx.storage.getUrl(previewBlob)
      expect(imageUrl).toBeNull()
      expect(previewUrl).toBeNull()
    })
  })

  it('deleting item with null previewStorageId works fine', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(noteId, {
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: noteId },
    )

    await t.run(async (dbCtx) => {
      const note = await dbCtx.db.get(noteId)
      expect(note).toBeNull()
    })
  })

  it('deleting a folder with no preview works fine', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
    )

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch(folderId, {
        location: SIDEBAR_ITEM_LOCATION.trash,
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(
      api.sidebarItems.mutations.permanentlyDeleteSidebarItem,
      { itemId: folderId },
    )

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get(folderId)
      expect(folder).toBeNull()
    })
  })
})
