import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createNoteViaFilesystem,
  createGameMapViaFilesystem,
  createCanvasViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'
import { createGameMap, createNote, getSidebarItemRowId } from '../../_test/factories.helper'
import { createMapWithTwoSnapshotPins } from '../../_test/documentSnapshots.helper'
import { api } from '../../_generated/api'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { DOCUMENT_SNAPSHOT_TYPE } from '../types'
import { makeYjsUpdate } from '../../_test/yjs.helper'
import { SNAPSHOT_IDLE_MS, SNAPSHOT_MIN_INTERVAL_MS } from '../../yjsSync/constants'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'

describe('pushUpdate trailing-edge snapshot scheduling', () => {
  const t = createTestContext()

  it('creates snapshot after idle timeout', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Snapshot Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.YjsState)
        expect(snapshots[0].itemType).toBe(RESOURCE_TYPES.notes)
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'History Entry Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Rapid Edit Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      // Push again before idle timeout — seq advances, so the first
      // scheduled maybeCreateSnapshot should see a stale triggerSeq and bail
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        // Only the second push's scheduled function should have created a snapshot
        expect(snapshots).toHaveLength(1)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Interval Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      // First push — will create snapshot after idle
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Advance past idle but NOT past minimum interval
      vi.advanceTimersByTime(SNAPSHOT_IDLE_MS + 1)

      // Second push — snapshot function fires but minimum interval not met
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        expect(snapshots).toHaveLength(1)
      })

      // Advance past the minimum interval from the first snapshot
      vi.advanceTimersByTime(SNAPSHOT_MIN_INTERVAL_MS)

      // Third push — now minimum interval has passed
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Burst Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      for (let i = 0; i < 5; i++) {
        await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          campaignId: ctx.campaignDomainId,
          documentId: noteId,
          update: makeYjsUpdate(),
        })
      }

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        expect(snapshots).toHaveLength(1)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Updated Time Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      const beforeNote = await t.run(async (dbCtx) => {
        return await dbCtx.db.get('sidebarItems', noteRowId)
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const note = await dbCtx.db.get('sidebarItems', noteRowId)
        expect(note!.updatedBy).toBe(ctx.dm.memberDomainId)
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

      const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Snapshot Canvas',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const canvasRowId = await getSidebarItemRowId(t, canvasId)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: canvasId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', canvasRowId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.YjsState)
        expect(snapshots[0].itemType).toBe(RESOURCE_TYPES.canvases)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', canvasRowId).eq('action', 'content_edited'),
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Deleted Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      // Hard-delete the document before the scheduled function fires
      await t.run(async (dbCtx) => {
        await dbCtx.db.delete('sidebarItems', noteRowId)
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
          .collect()

        expect(snapshots).toHaveLength(0)

        const historyEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteRowId).eq('action', 'content_edited'),
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

  it('createItemPins creates snapshot on first pin add', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(snapshots).toHaveLength(1)
        expect(snapshots[0].snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.GameMap)

        const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshots[0].data))
        expect(parsed.pins).toHaveLength(1)
        expect(parsed.pins[0].x).toBe(10)
        expect(parsed.pins[0].y).toBe(20)

        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_pin_added'),
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

      const { mapRowId } = await createMapWithTwoSnapshotPins(t, dmAuth, {
        campaignId: ctx.campaignId,
        campaignDomainId: ctx.campaignDomainId,
        ownerId: ctx.dm.profile._id,
      })

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
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

      const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      expect(pinIds).toHaveLength(1)
      const pinId = pinIds[0]!
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.removeItemPin, {
        campaignId: ctx.campaignDomainId,
        mapPinId: pinId,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const removeHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_pin_removed'),
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

      const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      expect(pinIds).toHaveLength(1)
      const pinId = pinIds[0]!
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        campaignId: ctx.campaignDomainId,
        mapPinId: pinId,
        x: 50,
        y: 60,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const moveHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_pin_moved'),
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

      const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      expect(pinIds).toHaveLength(1)
      const pinId = pinIds[0]!
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.updatePinVisibility, {
        campaignId: ctx.campaignDomainId,
        mapPinId: pinId,
        visible: true,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(snapshots).toHaveLength(2)

        const visHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_pin_visibility_changed'),
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

      const { sessionId } = await storeCommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['test'], { type: 'image/png' }),
        'map.png',
      )

      const result = await createGameMapViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Test Map',
        parentTarget: { kind: 'direct', parentId: null },
        uploadSessionId: sessionId,
      })
      const mapRowId = await getSidebarItemRowId(t, result.mapId)

      await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignDomainId,
        mapId: result.mapId,
        replacementToken: null,
        uploadSessionId: null,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_image_removed'),
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

      const { mapId: map1, mapRowId: map1RowId } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { mapId: map2, mapRowId: map2RowId } = await createGameMap(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )
      const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      // Pin on map1
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId: map1,
        pins: [{ itemId: n1, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Pin on map2 — different map, should get its own snapshot
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId: map2,
        pins: [{ itemId: n2, x: 30, y: 40 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const snap1 = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', map1RowId))
          .collect()
        const snap2 = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', map2RowId))
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

  it('rollback preserves both the previous and restored states', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapRowId).eq('action', 'map_pin_added'),
          )
          .first()
      })
      expect(historyEntry).not.toBeNull()

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignDomainId,
        editHistoryId: historyEntry!.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const allSnapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapRowId))
          .collect()

        expect(allSnapshots).toHaveLength(3)

        const rolledBackHistory = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapRowId).eq('action', 'rolled_back'))
          .first()
        expect(rolledBackHistory).not.toBeNull()
        expect(rolledBackHistory!.hasSnapshot).toBe(true)

        const activePins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapRowId))
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
