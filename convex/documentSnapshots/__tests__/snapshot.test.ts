import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { SNAPSHOT_TYPE } from '../schema'
import {
  makeYjsUpdate,
  makeYjsUpdateWithBlocks,
} from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import type { GameMapSnapshotData } from '../../gameMaps/types'

describe('note snapshots capture Y.Doc state directly', () => {
  const t = createTestContext()

  it('snapshot captures Y.Doc state directly, not stale blocks table', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Content Test Note',
        parentId: null,
      })

      const blocks = [
        {
          id: 'block-1',
          type: 'paragraph' as const,
          content: [{ type: 'text' as const, text: 'Hello world' }],
          props: {},
          children: [],
        },
      ]
      const yjsUpdate = makeYjsUpdateWithBlocks(blocks)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: yjsUpdate,
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const snapshot = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', noteId))
          .first()
      })

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)

      const doc = new Y.Doc()
      Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
      const sv = Y.encodeStateVector(doc)
      doc.destroy()
      expect(sv.length).toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('game map operations are rollbackable after every operation', () => {
  const t = createTestContext()

  it('every pin operation should be rollbackable', async () => {
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
      const { noteId: n3 } = await createNote(
        t,
        ctx.campaignId,
        ctx.dm.profile._id,
      )

      // Add 3 pins in quick succession
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 50,
        y: 60,
        itemId: n3,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()

        const pinAddEntries = history.filter(
          (h) => h.action === 'map_pin_added',
        )
        expect(pinAddEntries).toHaveLength(3)

        for (const entry of pinAddEntries) {
          expect(entry.hasSnapshot).toBe(true)
        }
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('each pin operation should have a corresponding snapshot', async () => {
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

      // Add pin
      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        mapId,
        x: 10,
        y: 20,
        itemId: n1,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Add another pin
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

        // There should be 2 snapshots — one per pin operation
        expect(snapshots).toHaveLength(2)

        // The second snapshot should show 2 pins
        const sorted = snapshots.sort(
          (a, b) => a._creationTime - b._creationTime,
        )

        function parseSnapshotData(
          snapshot: (typeof sorted)[number],
          index: number,
        ): GameMapSnapshotData {
          try {
            return JSON.parse(new TextDecoder().decode(snapshot.data))
          } catch (e) {
            throw new Error(
              `Failed to parse snapshot at index ${index} (id=${snapshot._id}, createdAt=${snapshot._creationTime}): ${e}`,
            )
          }
        }

        const firstData = parseSnapshotData(sorted[0], 0)
        const secondData = parseSnapshotData(sorted[1], 1)

        expect(firstData.pins).toHaveLength(1)
        expect(secondData.pins).toHaveLength(2)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('pin move should be rollbackable', async () => {
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

      // Add pin
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

      // Move pin
      await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        mapPinId: pinId,
        x: 50,
        y: 60,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const moveEntry = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_moved'),
          )
          .first()

        expect(moveEntry).not.toBeNull()
        expect(moveEntry!.hasSnapshot).toBe(true)

        // And the snapshot should exist
        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) =>
            q.eq('editHistoryId', moveEntry!._id),
          )
          .first()
        expect(snapshot).not.toBeNull()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('pin removal should be rollbackable', async () => {
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
        const removeEntry = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_removed'),
          )
          .first()

        expect(removeEntry).not.toBeNull()
        expect(removeEntry!.hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('visibility toggle should be rollbackable', async () => {
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
        const visEntry = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_visibility_changed'),
          )
          .first()

        expect(visEntry).not.toBeNull()
        expect(visEntry!.hasSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('snapshot exists when history entry claims hasSnapshot=true', () => {
  const t = createTestContext()

  it('snapshot should exist when history entry claims hasSnapshot=true', async () => {
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

      // Run scheduled functions so the async snapshot is created
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .first()

        expect(history).not.toBeNull()
        expect(history!.hasSnapshot).toBe(true)

        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) =>
            q.eq('editHistoryId', history!._id),
          )
          .first()

        expect(snapshot).not.toBeNull()
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('getSnapshotForHistoryEntry returns data when hasSnapshot is true', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Async Race Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeYjsUpdate(),
      })

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', noteId).eq('action', 'content_edited'),
          )
          .first()
      })

      expect(historyEntry).not.toBeNull()
      expect(historyEntry!.hasSnapshot).toBe(true)

      const snapshot = await dmAuth.query(
        api.documentSnapshots.queries.getSnapshotForHistoryEntry,
        { editHistoryId: historyEntry!._id },
      )

      expect(snapshot).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback data integrity', () => {
  const t = createTestContext()

  it('rolling back a map should restore pin positions correctly', async () => {
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

      // Add pin at original position
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

      // Get the history entry for the pin add
      const addEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', mapId).eq('action', 'map_pin_added'),
          )
          .first()
      })
      expect(addEntry!.hasSnapshot).toBe(true)

      // Move pin to new position
      await dmAuth.mutation(api.gameMaps.mutations.updateItemPin, {
        mapPinId: pinId,
        x: 99,
        y: 99,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Rollback to the pin add snapshot
      await dmAuth.mutation(
        api.documentSnapshots.mutations.rollbackToSnapshot,
        { editHistoryId: addEntry!._id },
      )

      // Verify the pin is back at original position
      await t.run(async (dbCtx) => {
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
