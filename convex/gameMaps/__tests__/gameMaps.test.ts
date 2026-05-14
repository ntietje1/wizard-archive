import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_STATUS } from '../../sidebarItems/types/baseTypes'

describe('game map APIs', () => {
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
        { itemId: south.noteId, x: 100, y: 0 },
      ],
    })

    expect(pinIds).toHaveLength(2)
    const result = await dmAuth.query(api.gameMaps.queries.getMap, {
      campaignId: ctx.campaignId,
      mapId: map.mapId,
    })
    expect(result).toMatchObject({
      _id: map.mapId,
      name: 'World Map',
      pins: [
        { itemId: north.noteId, x: 0, y: 100, item: { _id: north.noteId, name: 'North' } },
        { itemId: south.noteId, x: 100, y: 0, item: { _id: south.noteId, name: 'South' } },
      ],
    })
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

  it('rejects duplicate, self, and trashed pin targets', async () => {
    const t = createTestContext()
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const map = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const trashed = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Trashed Source',
      status: SIDEBAR_ITEM_STATUS.trashed,
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
    expect(visibleMap).toMatchObject({ _id: map.mapId, name: 'Shared Map', pins: [] })

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
})
