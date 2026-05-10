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
import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'

describe('createMap', () => {
  const t = createTestContext()

  it('creates a map with imageStorageId null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
      campaignId: ctx.campaignId,
      name: 'World Map',
      parentTarget: { kind: 'direct', parentId: null },
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
        parentTarget: { kind: 'direct', parentId: null },
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
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentTarget: { kind: 'direct', parentId: null },
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

    await createSidebarShare(t, {
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

    await createSidebarShare(t, {
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

    const pinId = (
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 100, y: 100 }],
      })
    )[0]!

    expect(pinId).toBeDefined()

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin).not.toBeNull()
      expect(pin!.mapId).toBe(mapId)
      expect(pin!.itemId).toBe(noteId)
      expect(pin!.x).toBe(100)
      expect(pin!.y).toBe(100)
      expect(pin!.visible).toBe(false)
    })
  })

  it('accepts boundary pin coordinates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const first = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'First' })
    const second = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Second' })

    const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId,
      pins: [
        { itemId: first.noteId, x: 0, y: 0 },
        { itemId: second.noteId, x: 100, y: 100 },
      ],
    })

    expect(pinIds).toHaveLength(2)
    await t.run(async (dbCtx) => {
      const firstPin = await dbCtx.db.get('mapPins', pinIds[0]!)
      const secondPin = await dbCtx.db.get('mapPins', pinIds[1]!)
      expect(firstPin?.x).toBe(0)
      expect(firstPin?.y).toBe(0)
      expect(secondPin?.x).toBe(100)
      expect(secondPin?.y).toBe(100)
    })
  })

  it('rejects out-of-range and non-finite pin coordinates before inserting pins', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    for (const pin of [
      { itemId: noteId, x: -1, y: 50 },
      { itemId: noteId, x: 101, y: 50 },
      { itemId: noteId, x: Number.NEGATIVE_INFINITY, y: 50 },
      { itemId: noteId, x: 50, y: -1 },
      { itemId: noteId, x: 50, y: 101 },
      { itemId: noteId, x: 50, y: Number.NEGATIVE_INFINITY },
      { itemId: noteId, x: Number.NaN, y: 50 },
      { itemId: noteId, x: 50, y: Number.POSITIVE_INFINITY },
    ]) {
      await expectValidationFailed(
        dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
          campaignId: ctx.campaignId,
          mapId,
          pins: [pin],
        }),
      )
    }

    await t.run(async (dbCtx) => {
      const pins = await dbCtx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
        .collect()
      expect(pins).toHaveLength(0)
    })
  })

  it('creates multiple pins in one batch', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const first = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'First' })
    const second = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Second' })

    const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId,
      pins: [
        { itemId: first.noteId, x: 10, y: 20 },
        { itemId: second.noteId, x: 30, y: 40 },
      ],
    })

    expect(pinIds).toHaveLength(2)

    await t.run(async (dbCtx) => {
      const pins = await dbCtx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
        .collect()
      expect(pins.map((pin) => pin.itemId).sort()).toEqual([first.noteId, second.noteId].sort())
      const historyRows = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
        .collect()
      expect(historyRows).toHaveLength(1)
    })
  })

  it('rejects oversized batch pin requests before inserting pins', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: Array.from({ length: 101 }, (_, index) => ({
          itemId: noteId,
          x: index,
          y: index,
        })),
      }),
    )

    await t.run(async (dbCtx) => {
      const pins = await dbCtx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
        .collect()
      expect(pins).toHaveLength(0)
    })
  })

  it('rejects duplicate item ids in one pin batch', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [
          { itemId: noteId, x: 10, y: 20 },
          { itemId: noteId, x: 30, y: 40 },
        ],
      }),
    )

    await t.run(async (dbCtx) => {
      const pins = await dbCtx.db
        .query('mapPins')
        .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
        .collect()
      expect(pins).toHaveLength(0)
    })
  })

  it('rejects a batch pin that includes an invalid item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [
          { itemId: noteId, x: 10, y: 20 },
          { itemId: mapId, x: 30, y: 40 },
        ],
      }),
    )
  })

  it('rejects a batch pin that includes a trashed item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
        location: SIDEBAR_ITEM_LOCATION.trash,
      })
    })

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      }),
    )
  })

  it('rejects duplicate pin for same item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId,
      pins: [{ itemId: noteId, x: 10, y: 20 }],
    })

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 30, y: 40 }],
      }),
    )
  })

  it('rejects pinning a map to itself', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: mapId, x: 10, y: 20 }],
      }),
    )
  })

  it('updates pin position', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = (
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
    )[0]!

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

    const pinId = (
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
    )[0]!

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

  it('removes a pin via hard delete', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinId = (
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
    )[0]!

    await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
    })

    await t.run(async (dbCtx) => {
      const pin = await dbCtx.db.get('mapPins', pinId)
      expect(pin).toBeNull()
    })
  })

  it('requires EDIT permission on map for pin operations', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      }),
    )
  })

  it('player with EDIT permission can create pins', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: mapId,
      sidebarItemType: 'gameMap',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const pinId = (
      await playerAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
    )[0]!
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

    await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
      campaignId: ctx.campaignId,
      mapId,
      pins: [{ itemId: noteId, x: 10, y: 20 }],
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
