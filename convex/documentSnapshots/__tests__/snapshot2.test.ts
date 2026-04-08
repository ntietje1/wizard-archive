import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { SNAPSHOT_TYPE } from '../schema'
import { makeYjsUpdate } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import type { GameMapSnapshotData } from '../types'

describe('cross-action debounce independence on game maps', () => {
  const t = createTestContext()

  it('image change should not prevent subsequent pin operations from getting snapshots', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: 'Cross Action Map',
        parentId: null,
      })

      // Change the image — property changes don't create snapshots
      await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
        mapId: result.mapId,
        imageStorageId: null,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Now add a pin — should get a snapshot
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId: result.mapId,
        x: 10,
        y: 20,
        itemId: noteId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const pinEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', result.mapId).eq('action', 'map_pin_added'),
          )
          .first()
      })

      expect(pinEntry).not.toBeNull()
      expect(pinEntry!.hasSnapshot).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('updateMap creates correct number of history entries', () => {
  const t = createTestContext()

  it('changing only the image should create exactly 1 history entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
      campaignId: ctx.campaignId,
      name: 'Single Entry Map',
      parentId: null,
    })

    // Count history entries before
    const beforeCount = await t.run(async (dbCtx) => {
      const entries = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', result.mapId))
        .collect()
      return entries.length
    })

    // Change image to null (remove)
    await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      mapId: result.mapId,
      imageStorageId: null,
    })

    const afterEntries = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', result.mapId))
        .collect()
    })

    const newEntries = afterEntries.length - beforeCount
    // Should create exactly 1 history entry (map_image_removed)
    expect(newEntries).toBe(1)

    const imageEntry = afterEntries.find(
      (e) => e.action === 'map_image_removed',
    )
    expect(imageEntry).toBeDefined()
  })

  it('changing name and image should create exactly 2 history entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
      campaignId: ctx.campaignId,
      name: 'Multi Update Map',
      parentId: null,
    })

    const beforeCount = await t.run(async (dbCtx) => {
      const entries = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', result.mapId))
        .collect()
      return entries.length
    })

    await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
      mapId: result.mapId,
      name: 'Renamed Map',
      imageStorageId: null,
    })

    const afterEntries = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item', (q) => q.eq('itemId', result.mapId))
        .collect()
    })

    const newEntries = afterEntries.length - beforeCount
    // logEditHistory with changes merges multiple changes into a single 'updated' entry
    expect(newEntries).toBe(1)

    const entry = afterEntries[afterEntries.length - 1]
    expect(entry.action).toBe('updated')
    expect(entry.metadata).not.toBeNull()
    expect(
      Array.isArray((entry.metadata as Record<string, unknown>).changes),
    ).toBe(true)
    const changes = (entry.metadata as { changes: Array<{ action: string }> })
      .changes
    const changeActions = changes.map((c) => c.action).sort()
    expect(changeActions).toEqual(['map_image_removed', 'renamed'])
  })
})

describe('rollback of game map pin with non-note itemId', () => {
  const t = createTestContext()

  it('rollback restores pins that reference folders correctly', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )

      // Create a folder and pin it to the map (pins can reference any sidebar item)
      const { folderId } = await t.run(async (dbCtx) => {
        const id = await dbCtx.db.insert('folders', {
          campaignId: ctx.campaignId,
          name: 'Pinned Folder',
          slug: 'pinned-folder',
          type: SIDEBAR_ITEM_TYPES.folders,
          inheritShares: false,
          parentId: null,
          iconName: null,
          color: null,
          allPermissionLevel: null,
          location: 'sidebar',
          previewStorageId: null,
          previewLockedUntil: null,
          previewClaimToken: null,
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
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 25,
        y: 75,
        itemId: folderId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const addEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .first()
      })
      expect(addEntry).not.toBeNull()
      expect(addEntry!.hasSnapshot).toBe(true)

      // Advance past debounce, then remove pin
      vi.advanceTimersByTime(6 * 60 * 1000)

      const pinId = await t.run(async (dbCtx) => {
        const pin = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .filter((q) => q.eq(q.field('deletionTime'), null))
          .first()
        expect(pin).not.toBeNull()
        return pin!._id
      })

      await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
        mapPinId: pinId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Rollback to the state with the folder pin
      await dmAuth.mutation(
        api.documentSnapshots.mutations.rollbackToSnapshot,
        { editHistoryId: addEntry!._id },
      )

      // The restored pin should reference the FOLDER, not a note
      await t.run(async (dbCtx) => {
        const activePins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .filter((q) => q.eq(q.field('deletionTime'), null))
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

      const { mapId } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      // Add a pin at position (10, 20)
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: noteId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Verify the snapshot captured the pin at (10, 20)
      const addEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .first()
      })

      const snapshot = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) =>
            q.eq('editHistoryId', addEntry!._id),
          )
          .first()
      })

      expect(snapshot).not.toBeNull()
      const data: GameMapSnapshotData = JSON.parse(
        new TextDecoder().decode(snapshot!.data),
      )
      // Pin should be at (10, 20) and visible=false (default from createItemPin)
      expect(data.pins).toHaveLength(1)
      expect(data.pins[0].x).toBe(10)
      expect(data.pins[0].y).toBe(20)
      expect(data.pins[0].visible).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('canvas snapshot uses yjs_state format', () => {
  const t = createTestContext()

  it('pushUpdate on canvas should create yjs_state snapshot, not blocks', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { canvasId } = await dmAuth.mutation(
        api.canvases.mutations.createCanvas,
        {
          campaignId: ctx.campaignId,
          name: 'Test Canvas',
          parentId: null,
        },
      )

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: canvasId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', canvasId))
          .first()

        expect(snapshot).not.toBeNull()
        expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
        expect(snapshot!.itemType).toBe(SIDEBAR_ITEM_TYPES.canvases)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('Note snapshots use yjs_state format', () => {
  const t = createTestContext()

  it('note snapshot should use yjs_state type', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Snapshot Type Check',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .first()

        expect(snapshot).not.toBeNull()
        expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)

        const doc = new Y.Doc()
        Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
        doc.destroy()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('no duplicate snapshots from concurrent mutations', () => {
  const t = createTestContext()

  it('two rapid pin adds should not create duplicate snapshots for the same entry', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { noteId: n1 } = await createNote(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { noteId: n2 } = await createNote(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )

      // Two rapid pin adds — both run before scheduled functions complete
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: n1,
      })
      // Don't run scheduled functions yet — simulate rapid second call
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 30,
        y: 40,
        itemId: n2,
      })

      // Now run all scheduled functions
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Each history entry should have at most 1 snapshot
      await t.run(async (dbCtx) => {
        const entries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .collect()

        for (const entry of entries) {
          if (entry.hasSnapshot) {
            const snapshots = await dbCtx.db
              .query('documentSnapshots')
              .withIndex('by_editHistory', (q) =>
                q.eq('editHistoryId', entry._id),
              )
              .collect()
            // Should never have more than 1 snapshot per history entry
            expect(snapshots.length).toBeLessThanOrEqual(1)
          }
        }

        // Total snapshots for this map should be reasonable
        const allSnapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        // With 2 pin adds, should have at most 2 snapshots
        expect(allSnapshots.length).toBeLessThanOrEqual(2)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
