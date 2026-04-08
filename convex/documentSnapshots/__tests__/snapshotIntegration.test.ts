import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { SNAPSHOT_TYPE } from '../schema'
import { makeYjsUpdate } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import {
  SNAPSHOT_IDLE_MS,
  SNAPSHOT_MIN_INTERVAL_MS,
} from '../../yjsSync/constants'
import type { GameMapSnapshotData } from '../../gameMaps/types'

describe('pushUpdate trailing-edge snapshot scheduling', () => {
  const t = createTestContext()

  it('creates snapshot after idle timeout', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Snapshot Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
        expect(snapshots[0].itemType).toBe(SIDEBAR_ITEM_TYPES.notes)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates edit history entry with hasSnapshot=true', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'History Entry Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(1)
        expect(historyEntries[0].hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips snapshot when seq advances (user still editing)', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Rapid Edit Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      // Push again before idle timeout — seq advances, so the first
      // scheduled maybeCreateSnapshot should see a stale triggerSeq and bail
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        // Only the second push's scheduled function should have created a snapshot
        expect(snapshots).toHaveLength(1)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('enforces minimum interval between snapshots', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Interval Note',
        parentId: null,
      })

      // First push — will create snapshot after idle
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Advance past idle but NOT past minimum interval
      vi.advanceTimersByTime(SNAPSHOT_IDLE_MS + 1)

      // Second push — snapshot function fires but minimum interval not met
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        expect(snapshots).toHaveLength(1)
      })

      // Advance past the minimum interval from the first snapshot
      vi.advanceTimersByTime(SNAPSHOT_MIN_INTERVAL_MS)

      // Third push — now minimum interval has passed
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(2)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rapid edits produce only one snapshot after the last edit', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Burst Note',
        parentId: null,
      })

      for (let i = 0; i < 5; i++) {
        await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          documentId: noteId,
          update: makeYjsUpdate(),
        })
      }

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        expect(snapshots).toHaveLength(1)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates document updatedTime and updatedBy on snapshot', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Updated Time Note',
        parentId: null,
      })

      const beforeNote = await t.run(async (dbCtx) => {
        return await dbCtx.db.get(noteId)
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const note = await dbCtx.db.get(noteId)
        expect(note!.updatedBy).toBe(ctx.dm.profile._id)
        expect(note!.updatedTime).not.toBeNull()
        expect(note!.updatedTime).toBeGreaterThan(beforeNote!.updatedTime ?? 0)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates snapshot for canvas documents', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { canvasId } = await dmAuth.mutation(
        api.canvases.mutations.createCanvas,
        {
          campaignId: ctx.campaignId,
          name: 'Snapshot Canvas',
          parentId: null,
        },
      )

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: canvasId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', canvasId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
        expect(snapshots[0].itemType).toBe(SIDEBAR_ITEM_TYPES.canvases)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', canvasId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(1)
        expect(historyEntries[0].hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips snapshot when document is deleted before idle timeout fires', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Deleted Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      // Hard-delete the document before the scheduled function fires
      await t.run(async (dbCtx) => {
        await dbCtx.db.delete(noteId)
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .collect()

        expect(snapshots).toHaveLength(0)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .collect()

        expect(historyEntries).toHaveLength(0)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('game map pin mutations — snapshot scheduling', () => {
  const t = createTestContext()

  it('createItemPin creates snapshot on first pin add', async () => {
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: noteId,
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(SNAPSHOT_TYPE.game_map)

        const parsed: GameMapSnapshotData = JSON.parse(
          new TextDecoder().decode(snapshots[0].data),
        )
        expect(parsed.pins).toHaveLength(1)
        expect(parsed.pins[0].x).toBe(10)
        expect(parsed.pins[0].y).toBe(20)

        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .collect()
        expect(history).toHaveLength(1)
        expect(history[0].hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('every pin operation creates a snapshot (no debounce)', async () => {
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: n1,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 30,
        y: 40,
        itemId: n2,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(history).toHaveLength(2)

        for (const entry of history) {
          expect(entry.hasSnapshot).toBe(true)
        }
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('removeItemPin always creates a snapshot', async () => {
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

      const pinId = await dmAuth.mutation(
        api.gameMaps.mutations.createItemPin,
        {
          mapId,
          x: 10,
          y: 20,
          itemId: noteId,
        },
      )
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
        mapPinId: pinId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const removeHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_removed'),
          )
          .first()
        expect(removeHistory).not.toBeNull()
        expect(removeHistory!.hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('updateItemPin always creates a snapshot', async () => {
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

      const pinId = await dmAuth.mutation(
        api.gameMaps.mutations.createItemPin,
        {
          mapId,
          x: 10,
          y: 20,
          itemId: noteId,
        },
      )
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        mapPinId: pinId,
        x: 50,
        y: 60,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const moveHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_moved'),
          )
          .first()
        expect(moveHistory).not.toBeNull()
        expect(moveHistory!.hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('updatePinVisibility always creates a snapshot', async () => {
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

      const pinId = await dmAuth.mutation(
        api.gameMaps.mutations.createItemPin,
        {
          mapId,
          x: 10,
          y: 20,
          itemId: noteId,
        },
      )
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.updatePinVisibility, {
        mapPinId: pinId,
        visible: true,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const visHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_visibility_changed'),
          )
          .first()
        expect(visHistory).not.toBeNull()
        expect(visHistory!.hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('updateMap with image change creates history but no snapshot', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const storageId = await t.run(async (dbCtx) => {
        return await dbCtx.storage.store(new Blob(['test']))
      })

      const result = await dmAuth.mutation(api.gameMaps.mutations.createMap, {
        campaignId: ctx.campaignId,
        name: 'Test Map',
        parentId: null,
        imageStorageId: storageId,
      })

      await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
        mapId: result.mapId,
        imageStorageId: null,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', result.mapId).eq('action', 'map_image_removed'),
          )
          .collect()

        expect(history).toHaveLength(1)
        expect(history.every((h) => !h.hasSnapshot)).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('each map receives its own snapshot independently', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId: map1 } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { mapId: map2 } = await createGameMap(
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

      // Pin on map1
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId: map1,
        x: 10,
        y: 20,
        itemId: n1,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Pin on map2 — different map, should get its own snapshot
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId: map2,
        x: 30,
        y: 40,
        itemId: n2,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snap1 = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', map1))
          .collect()
        const snap2 = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', map2))
          .collect()

        expect(snap1).toHaveLength(1)
        expect(snap2).toHaveLength(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollbackToSnapshot', () => {
  const t = createTestContext()

  it('rollback creates history entry without snapshot', async () => {
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: noteId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .first()
      })
      expect(historyEntry).not.toBeNull()

      await dmAuth.mutation(
        api.documentSnapshots.mutations.rollbackToSnapshot,
        {
          editHistoryId: historyEntry!._id,
        },
      )

      await t.run(async (dbCtx) => {
        const allSnapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        expect(allSnapshots).toHaveLength(1)

        const rolledBackHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'rolled_back'),
          )
          .first()
        expect(rolledBackHistory).not.toBeNull()
        expect(rolledBackHistory!.hasSnapshot).toBe(false)

        const activePins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .filter((q) => q.eq(q.field('deletionTime'), null))
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
