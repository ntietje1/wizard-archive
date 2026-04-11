import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('createMap', () => {
  const t = createTestContext()

  it('creates a map with imageStorageId null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
      campaignId: ctx.campaignId,
      name: 'World Map',
      parentId: null,
    })

    expect(result.mapId).toBeDefined()
    expect(result.slug).toContain('world-map')

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', result.mapId)
      expect(map).not.toBeNull()
      expect(map!.name).toBe('World Map')
      expect(map!.parentId).toBeNull()
      const ext = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', result.mapId))
        .first()
      expect(ext!.imageStorageId).toBeNull()
    })
  })

  it('player cannot create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: 'Player Map',
        parentId: null,
      }),
    )
  })

  it('validates name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: '',
        parentId: null,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentId: null,
      }),
    )
  })
})

describe('updateMap', () => {
  const t = createTestContext()

  it('updates name and regenerates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original Map',
    })

    const result = await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      campaignId: ctx.campaignId,
      mapId,
      name: 'Renamed Map',
    })

    expect(result.mapId).toBe(mapId)
    expect(result.slug).toContain('renamed-map')

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      expect(map!.name).toBe('Renamed Map')
    })
  })

  it('requires FULL_ACCESS permission for player', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.gameMaps.mutations.updateMap, {
        campaignId: ctx.campaignId,
        mapId,
        name: 'Hacked',
      }),
    )
  })

  it('allows player with FULL_ACCESS to update', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.gameMaps.mutations.updateMap, {
      campaignId: ctx.campaignId,
      mapId,
      name: 'Player Updated',
    })
    expect(result.mapId).toBe(mapId)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.gameMaps.mutations.updateMap, {
        campaignId: ctx.campaignId,
        mapId,
        name: 'Nope',
      }),
    )
  })

  it('updating imageStorageId also sets previewStorageId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['map-image']))
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      campaignId: ctx.campaignId,
      mapId,
      imageStorageId: storageId,
    })

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      expect(map!.previewStorageId).toBe(storageId)
      const ext = await dbCtx.db
        .query('gameMaps')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
        .first()
      expect(ext!.imageStorageId).toBe(storageId)
    })
  })

  it('updating only name does not change previewStorageId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const storageId = await t.run(async (dbCtx) => {
      return await dbCtx.storage.store(new Blob(['map-image']))
    })

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', mapId, { previewStorageId: storageId })
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      campaignId: ctx.campaignId,
      mapId,
      name: 'New Name',
    })

    await t.run(async (dbCtx) => {
      const map = await dbCtx.db.get('sidebarItems', mapId)
      expect(map!.previewStorageId).toBe(storageId)
    })
  })
})

describe('pin CRUD', () => {
  const t = createTestContext()

  it('creates a pin on a map', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 100,
      y: 200,
      itemId: noteId,
    })

    expect(pinId).toBeDefined()

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin).not.toBeNull()
      expect(pin!.mapId).toBe(mapId)
      expect(pin!.itemId).toBe(noteId)
      expect(pin!.x).toBe(100)
      expect(pin!.y).toBe(200)
      expect(pin!.visible).toBe(false)
    })
  })

  it('rejects duplicate pin for same item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 30,
        y: 40,
        itemId: noteId,
      }),
    )
  })

  it('rejects pinning a map to itself', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 10,
        y: 20,
        itemId: mapId,
      }),
    )
  })

  it('updates pin position', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
      x: 50,
      y: 60,
    })

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin!.x).toBe(50)
      expect(pin!.y).toBe(60)
    })
  })

  it('updates pin visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })

    await dmAuth.mutation(api.gameMaps.mutations.updatePinVisibility, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
      visible: true,
    })

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin!.visible).toBe(true)
    })
  })

  it('removes a pin via soft delete', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })

    await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
    })

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin!.deletionTime).not.toBeNull()
    })
  })

  it('requires EDIT permission on map for pin operations', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 10,
        y: 20,
        itemId: noteId,
      }),
    )
  })

  it('player with EDIT permission can create pins', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const pinId = await playerAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })
    expect(pinId).toBeDefined()
  })
})

describe('getMap', () => {
  const t = createTestContext()

  it('returns map with pins and ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Test Map',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
      campaignId: ctx.campaignId,
      mapId,
      x: 10,
      y: 20,
      itemId: noteId,
    })

    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId,
    })

    expect(result).not.toBeNull()
    expect(result!._id).toBe(mapId)
    expect(result!.name).toBe('Test Map')
    expect(result!.ancestors).toBeDefined()
    expect(Array.isArray(result!.ancestors)).toBe(true)
    expect(result!.pins).toBeDefined()
    expect(result!.pins.length).toBe(1)
    expect(result!.pins[0].x).toBe(10)
    expect(result!.pins[0].y).toBe(20)
  })

  it('returns null for player without access to soft-deleted map', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id, {
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const result = await playerAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId,
    })
    expect(result).toBeNull()
  })

  it('returns null for nonexistent map', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', mapId)
    })

    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId,
    })
    expect(result).toBeNull()
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.query(api.gameMaps.queries.getMap, { campaignId: ctx.campaignId, mapId }),
    )
  })
})
