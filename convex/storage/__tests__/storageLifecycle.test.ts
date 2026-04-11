import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFile, createFolder, createGameMap } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('storage lifecycle with file/map deletion', () => {
  const t = createTestContext()

  it('permanently deleting a file removes its record', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Delete Me',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
    })

    const file = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', fileId))
    expect(file).toBeNull()
  })

  it('permanently deleting a gameMap removes its record', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Delete Map',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
    })

    const map = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', mapId))
    expect(map).toBeNull()
  })

  it('campaign deletion cleans up files and maps', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignId,
    })

    const [file, map] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', fileId),
      await dbCtx.db.get('sidebarItems', mapId),
    ])
    expect(file).toBeNull()
    expect(map).toBeNull()
  })

  it('emptyTrashBin cleans up files inside trashed folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Folder with File',
    })
    const { fileId } = await createFile(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Nested File',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: folderId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const [folder, file] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', folderId),
      await dbCtx.db.get('sidebarItems', fileId),
    ])
    expect(folder).toBeNull()
    expect(file).toBeNull()
  })

  it('deleting a file with null storageId does not error on storage cleanup', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'No Storage File',
      storageId: null,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: fileId,
    })

    const file = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', fileId))
    expect(file).toBeNull()
  })

  it('deleting a map with null imageStorageId does not error on storage cleanup', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'No Storage Map',
      imageStorageId: null,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: mapId,
    })

    const map = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', mapId))
    expect(map).toBeNull()
  })
})
