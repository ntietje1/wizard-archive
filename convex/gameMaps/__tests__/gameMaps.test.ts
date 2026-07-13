import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import { expectConflict, expectValidationFailed } from '../../_test/assertions.helper'
import { storeUncommittedTestUploadSession } from '../../_test/storage.helper'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'

describe('game map APIs', () => {
  it('rejects missing storage ids for map images without persisting them', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const deletedUpload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['deleted-image'], { type: 'image/png' }),
      'deleted.png',
    )
    await t.run(async (dbCtx) => dbCtx.storage.delete(deletedUpload.storageId))
    const replacementToken = await dmAuth.mutation(
      api.gameMaps.mutations.beginMapImageReplacement,
      { campaignId: ctx.campaignId, mapId: map.mapId },
    )

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        replacementToken,
        uploadSessionId: deletedUpload.sessionId,
      }),
    )

    await t.run(async (dbCtx) => {
      const item = await dbCtx.db.get('sidebarItems', map.mapId)
      const extension = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', map.mapId))
        .unique()
      expect(item?.previewStorageId).toBeNull()
      expect(extension?.imageStorageId).toBeNull()
    })
  })

  it('rejects non-image storage ids for map images', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const textUpload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['not an image'], { type: 'text/plain' }),
      'not-an-image.txt',
    )

    const replacementToken = await dmAuth.mutation(
      api.gameMaps.mutations.beginMapImageReplacement,
      { campaignId: ctx.campaignId, mapId: map.mapId },
    )
    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        replacementToken,
        uploadSessionId: textUpload.sessionId,
      }),
    )
    await t.run(async (dbCtx) => {
      await expect(dbCtx.db.get('fileStorage', textUpload.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it('persists valid image storage ids as map images and previews', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const imageUpload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['image'], { type: 'image/png' }),
      'map.png',
    )

    const replacementToken = await dmAuth.mutation(
      api.gameMaps.mutations.beginMapImageReplacement,
      { campaignId: ctx.campaignId, mapId: map.mapId },
    )
    await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      replacementToken,
      uploadSessionId: imageUpload.sessionId,
    })

    await t.run(async (dbCtx) => {
      const item = await dbCtx.db.get('sidebarItems', map.mapId)
      const extension = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', map.mapId))
        .unique()
      expect(item?.previewStorageId).toBe(imageUpload.storageId)
      expect(extension?.imageStorageId).toBe(imageUpload.storageId)
      await expect(dbCtx.db.get('fileStorage', imageUpload.sessionId)).resolves.toMatchObject({
        status: 'committed',
      })
    })
  })

  it('rejects an older replacement token after a newer request starts', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const olderUpload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['older'], { type: 'image/png' }),
      'older.png',
    )
    const newerUpload = await storeUncommittedTestUploadSession(
      t,
      ctx.dm.profile._id,
      new Blob(['newer'], { type: 'image/png' }),
      'newer.png',
    )
    const olderToken = await dmAuth.mutation(api.gameMaps.mutations.beginMapImageReplacement, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    const newerToken = await dmAuth.mutation(api.gameMaps.mutations.beginMapImageReplacement, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      replacementToken: newerToken,
      uploadSessionId: newerUpload.sessionId,
    })
    await expectConflict(
      dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        replacementToken: olderToken,
        uploadSessionId: olderUpload.sessionId,
      }),
    )

    await t.run(async (dbCtx) => {
      const extension = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', map.mapId))
        .unique()
      expect(extension?.imageStorageId).toBe(newerUpload.storageId)
      await expect(dbCtx.db.get('fileStorage', olderUpload.sessionId)).resolves.toMatchObject({
        status: 'uncommitted',
      })
    })
  })

  it('creates one or many item pins with validated boundary coordinates', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, { name: 'World Map' })
    const north = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'North' })
    const south = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'South' })

    const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      pins: [
        { itemId: north.noteId, x: 0, y: 100 },
        { itemId: south.noteId, layerId: 'upper', x: 100, y: 0 },
      ],
    })

    expect(pinIds).toHaveLength(2)
    expect(pinIds.every(isUuidV7)).toBe(true)
    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    expect(result).toMatchObject({
      id: map.mapId,
      name: 'World Map',
      pins: [
        { itemId: north.noteId, x: 0, y: 100, item: { id: north.noteId, name: 'North' } },
        {
          itemId: south.noteId,
          layerId: 'upper',
          x: 100,
          y: 0,
          item: { id: south.noteId, name: 'South' },
        },
      ],
    })
  })

  it('returns cyclic map pins as shallow items instead of recursively hydrating content', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const mapA = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Map A' })
    const mapB = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Map B' })

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: mapA.mapId,
      pins: [{ itemId: mapB.mapId, x: 25, y: 25 }],
    })
    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: mapB.mapId,
      pins: [{ itemId: mapA.mapId, x: 75, y: 75 }],
    })

    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: mapA.mapId,
    })

    expect(result?.pins).toHaveLength(1)
    expect(result?.pins[0]).toMatchObject({
      itemId: mapB.mapId,
      item: { id: mapB.mapId, name: 'Map B' },
      x: 25,
      y: 25,
    })
    expect(result?.pins[0]?.item).not.toHaveProperty('pins')
  })

  it('rejects non-finite and out-of-range pin coordinates', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: NaN, y: 50 }],
      }),
    ).rejects.toThrow('Pin x coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: 50, y: Infinity }],
      }),
    ).rejects.toThrow('Pin y coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: -Infinity, y: 50 }],
      }),
    ).rejects.toThrow('Pin x coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: -1, y: 50 }],
      }),
    ).rejects.toThrow('Pin x coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: 50, y: 101 }],
      }),
    ).rejects.toThrow('Pin y coordinate must be between 0 and 100')
  })

  it('rejects pin moves with non-finite and out-of-range coordinates without persisting them', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const [pinId] = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      pins: [{ itemId: note.noteId, x: 10, y: 20 }],
    })

    await expect(
      dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
        x: Number.NaN,
        y: 20,
      }),
    ).rejects.toThrow('Pin x coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
        x: 10,
        y: Number.POSITIVE_INFINITY,
      }),
    ).rejects.toThrow('Pin y coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
        x: -1,
        y: 20,
      }),
    ).rejects.toThrow('Pin x coordinate must be between 0 and 100')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
        x: 10,
        y: 101,
      }),
    ).rejects.toThrow('Pin y coordinate must be between 0 and 100')

    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    expect(result?.pins).toMatchObject([{ id: pinId, x: 10, y: 20 }])
  })

  it('rejects provider-shaped map pin IDs', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)

    await expectValidationFailed(
      asDm(ctx).mutation(api.gameMaps.mutations.removeItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: 'provider-row-id',
      }),
    )
  })

  it('rejects duplicate, self, and trashed pin targets', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const trashed = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Trashed Source',
      status: RESOURCE_STATUS.trashed,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      pins: [{ itemId: note.noteId, x: 10, y: 10 }],
    })

    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: 20, y: 20 }],
      }),
    ).rejects.toThrow('Item is already pinned on this map')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: map.mapId, x: 20, y: 20 }],
      }),
    ).rejects.toThrow('Cannot pin a map to itself')
    await expect(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: trashed.noteId, x: 20, y: 20 }],
      }),
    ).rejects.toThrow('Restore the item before pinning it to a map')
  })

  it('enforces edit access for item pin creation while getMap remains viewable', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Map',
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Note',
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })

    await expect(
      playerAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId: map.mapId,
        pins: [{ itemId: note.noteId, x: 50, y: 50 }],
      }),
    ).rejects.toThrow('You do not have sufficient permission for this item')

    const visibleMap = await playerAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    expect(visibleMap).toMatchObject({ id: map.mapId, name: 'Shared Map', pins: [] })

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      pins: [{ itemId: note.noteId, x: 50, y: 50 }],
    })
    const updatedMap = await playerAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    expect(updatedMap?.pins).toHaveLength(1)
  })

  it('redacts pinned item payloads the viewer cannot access', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Map',
      allPermissionLevel: PERMISSION_LEVEL.VIEW,
    })
    const hiddenNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Note',
    })

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
      pins: [{ itemId: hiddenNote.noteId, x: 25, y: 75 }],
    })

    const result = await playerAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })

    expect(result?.pins).toHaveLength(1)
    expect(result?.pins[0]).toMatchObject({
      itemId: hiddenNote.noteId,
      item: null,
      x: 25,
      y: 75,
    })
  })
})
