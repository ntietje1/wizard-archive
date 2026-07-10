import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import {
  createMapWithTwoSnapshotPins,
  createSnapshotPin,
  getEditHistoryEntryByItemAction,
  getSnapshotForEditHistoryEntry,
  parseGameMapSnapshotData,
} from '../../_test/documentSnapshots.helper'
import { api } from '../../_generated/api'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { SNAPSHOT_MIN_INTERVAL_MS } from '../../yjsSync/constants'

describe('game map operations are rollbackable after every operation', () => {
  const t = createTestContext()
  let ctx: Awaited<ReturnType<typeof setupCampaignContext>>
  let dmAuth: ReturnType<typeof asDm>

  beforeEach(async () => {
    vi.useFakeTimers()
    ctx = await setupCampaignContext(t)
    dmAuth = asDm(ctx)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('every pin operation should be rollbackable', async () => {
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n3 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: n1,
      x: 10,
      y: 20,
    })

    await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: n2,
      x: 30,
      y: 40,
    })

    await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: n3,
      x: 50,
      y: 60,
    })

    await t.run(async (dbCtx) => {
      const history = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', mapId))
        .collect()

      const pinAddEntries = history.filter((h) => h.action === 'map_pin_added')
      expect(pinAddEntries).toHaveLength(3)

      for (const entry of pinAddEntries) {
        expect(entry.hasSnapshot).toBe(true)
      }
    })
  })

  it('each pin operation should have a corresponding snapshot', async () => {
    const { mapId } = await createMapWithTwoSnapshotPins(t, dmAuth, {
      campaignId: ctx.campaignId,
      ownerId: ctx.dm.profile._id,
    })

    await t.run(async (dbCtx) => {
      const snapshots = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_item', (q) => q.eq('itemId', mapId))
        .collect()

      // There should be 2 snapshots — one per pin operation
      expect(snapshots).toHaveLength(2)

      // The second snapshot should show 2 pins
      const sorted = snapshots.sort((a, b) => a._creationTime - b._creationTime)
      const firstData = parseGameMapSnapshotData(sorted[0], 'first pin operation')
      const secondData = parseGameMapSnapshotData(sorted[1], 'second pin operation')

      expect(firstData.pins).toHaveLength(1)
      expect(secondData.pins).toHaveLength(2)
    })
  })

  it('pin move should be rollbackable', async () => {
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinIds = await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: noteId,
      x: 10,
      y: 20,
    })
    expect(pinIds).toHaveLength(1)
    const pinId = pinIds[0]!

    // Move pin
    await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
      x: 50,
      y: 60,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (dbCtx) => {
      const moveEntry = await getEditHistoryEntryByItemAction(dbCtx.db, mapId, 'map_pin_moved')

      expect(moveEntry).not.toBeNull()
      expect(moveEntry!.hasSnapshot).toBe(true)

      // And the snapshot should exist
      const snapshot = await getSnapshotForEditHistoryEntry(dbCtx.db, moveEntry!._id)
      expect(snapshot).not.toBeNull()
    })
  })

  it('pin removal should be rollbackable', async () => {
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinIds = await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: noteId,
      x: 10,
      y: 20,
    })
    expect(pinIds).toHaveLength(1)
    const pinId = pinIds[0]!

    await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (dbCtx) => {
      const removeEntry = await getEditHistoryEntryByItemAction(dbCtx.db, mapId, 'map_pin_removed')

      expect(removeEntry).not.toBeNull()
      expect(removeEntry!.hasSnapshot).toBe(true)

      const snapshot = await getSnapshotForEditHistoryEntry(dbCtx.db, removeEntry!._id)
      expect(snapshot).not.toBeNull()
    })
  })

  it('visibility toggle should be rollbackable', async () => {
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const pinIds = await createSnapshotPin(t, dmAuth, {
      campaignId: ctx.campaignId,
      mapId,
      itemId: noteId,
      x: 10,
      y: 20,
    })
    expect(pinIds).toHaveLength(1)
    const pinId = pinIds[0]!

    await dmAuth.mutation(api.gameMaps.mutations.updatePinVisibility, {
      campaignId: ctx.campaignId,
      mapPinId: pinId,
      visible: true,
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    await t.run(async (dbCtx) => {
      const visEntry = await getEditHistoryEntryByItemAction(
        dbCtx.db,
        mapId,
        'map_pin_visibility_changed',
      )

      expect(visEntry).not.toBeNull()
      expect(visEntry!.hasSnapshot).toBe(true)

      const snapshot = await getSnapshotForEditHistoryEntry(dbCtx.db, visEntry!._id)
      expect(snapshot).not.toBeNull()
    })
  })
})

describe('rollback data integrity', () => {
  const t = createTestContext()

  it('rolling back a map should restore pin positions correctly', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      // Add pin at original position
      const pinIds = await createSnapshotPin(t, dmAuth, {
        campaignId: ctx.campaignId,
        mapId,
        itemId: noteId,
        x: 10,
        y: 20,
      })
      expect(pinIds).toHaveLength(1)
      const pinId = pinIds[0]!

      // Get the history entry for the pin add
      const addEntry = await t.run(
        async (dbCtx) => await getEditHistoryEntryByItemAction(dbCtx.db, mapId, 'map_pin_added'),
      )
      expect(addEntry!.hasSnapshot).toBe(true)

      // Move pin to new position
      await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
        x: 99,
        y: 99,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Rollback to the pin add snapshot
      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: addEntry!._id,
      })

      // Verify the pin is back at original position
      await t.run(async (dbCtx) => {
        const activePins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()

        expect(activePins).toHaveLength(1)
        expect(activePins[0].x).toBe(10)
        expect(activePins[0].y).toBe(20)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback of game map pin with non-note itemId', () => {
  const t = createTestContext()

  it('rollback restores pins that reference folders correctly', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

      // Create a folder and pin it to the map (pins can reference any sidebar item)
      const { folderId } = await t.run(async (dbCtx) => {
        const id = await dbCtx.db.insert('sidebarItems', {
          campaignId: ctx.campaignId,
          name: 'Pinned Folder',
          normalizedName: 'pinned folder',
          slug: 'pinned-folder',
          type: RESOURCE_TYPES.folders,
          parentId: null,
          iconName: null,
          color: null,
          allPermissionLevel: null,
          location: 'sidebar',
          status: 'active',
          previewStorageId: null,
          previewUpdatedAt: null,
          createdBy: ctx.dm.profile._id,
          updatedTime: null,
          updatedBy: null,
          deletionTime: null,
          deletedBy: null,
        })
        return { folderId: id }
      })

      // Add a pin for the folder
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: folderId, x: 25, y: 75 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const addEntry = await t.run(
        async (dbCtx) => await getEditHistoryEntryByItemAction(dbCtx.db, mapId, 'map_pin_added'),
      )
      expect(addEntry).not.toBeNull()
      expect(addEntry!.hasSnapshot).toBe(true)

      vi.advanceTimersByTime(SNAPSHOT_MIN_INTERVAL_MS + 60 * 1000)

      const pinId = await t.run(async (dbCtx) => {
        const pin = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .first()
        expect(pin).not.toBeNull()
        return pin!._id
      })

      await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
        campaignId: ctx.campaignId,
        mapPinId: pinId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Rollback to the state with the folder pin
      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: addEntry!._id,
      })

      // The restored pin should reference the FOLDER, not a note
      await t.run(async (dbCtx) => {
        const activePins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()

        expect(activePins).toHaveLength(1)
        // The itemId should be the folder, not miscast to a note
        expect(activePins[0].itemId).toBe(folderId)
        expect(activePins[0].x).toBe(25)
        expect(activePins[0].y).toBe(75)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('snapshot captures state at time of mutation', () => {
  const t = createTestContext()

  it('snapshot should reflect state at time of capture, enabling true rollback', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      // Add a pin at position (10, 20)
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Verify the snapshot captured the pin at (10, 20)
      const addEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      const snapshot = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) => q.eq('editHistoryId', addEntry!._id))
          .first()
      })

      expect(snapshot).not.toBeNull()
      const data = parseGameMapSnapshotData(snapshot!, 'pin add')
      // Pin should be at (10, 20) and visible=false (default from createItemPins)
      expect(data.pins).toHaveLength(1)
      expect(data.pins[0].x).toBe(10)
      expect(data.pins[0].y).toBe(20)
      expect(data.pins[0].visible).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
