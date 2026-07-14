import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createGameMapViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import {
  createSnapshotPin,
  getEditHistoryEntryByItemAction,
} from '../../_test/documentSnapshots.helper'
import { api } from '../../_generated/api'

describe('cross-action debounce independence on game maps', () => {
  const t = createTestContext()

  it('image change should not prevent subsequent pin operations from getting snapshots', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const result = await createGameMapViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Cross Action Map',
        parentTarget: { kind: 'direct', parentId: null },
      })

      // Change the image — property changes don't create snapshots
      await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignDomainId,
        mapId: result.mapId,
        replacementToken: null,
        uploadSessionId: null,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Now add a pin — should get a snapshot
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      await createSnapshotPin(t, dmAuth, {
        campaignId: ctx.campaignDomainId,
        mapId: result.mapId,
        itemId: noteId,
        x: 10,
        y: 20,
      })

      const pinEntry = await t.run(
        async (dbCtx) =>
          await getEditHistoryEntryByItemAction(dbCtx.db, result.mapId, 'map_pin_added'),
      )

      expect(pinEntry).not.toBeNull()
      expect(pinEntry!.hasSnapshot).toBe(true)
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

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await createSnapshotPin(t, dmAuth, {
        campaignId: ctx.campaignDomainId,
        mapId,
        itemId: n1,
        x: 10,
        y: 20,
        flushScheduledFunctions: false,
      })
      await createSnapshotPin(t, dmAuth, {
        campaignId: ctx.campaignDomainId,
        mapId,
        itemId: n2,
        x: 30,
        y: 40,
        flushScheduledFunctions: false,
      })

      // Now run all scheduled functions
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      // Each history entry should have at most 1 snapshot
      await t.run(async (dbCtx) => {
        const entries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .collect()

        for (const entry of entries) {
          if (entry.hasSnapshot) {
            const snapshots = await dbCtx.db
              .query('documentSnapshots')
              .withIndex('by_editHistory', (q) => q.eq('editHistoryId', entry._id))
              .collect()
            expect(snapshots.length).toBe(1)
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

  it('bulk pin add creates one snapshot entry for the batch', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      const pinIds = await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignDomainId,
        mapId,
        pins: [
          { itemId: n1, x: 10, y: 20 },
          { itemId: n2, x: 30, y: 40 },
        ],
      })
      expect(pinIds).toHaveLength(2)

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const pins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()
        expect(pins.map((pin) => pin.itemId).sort()).toEqual([n1, n2].sort())

        const entries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .collect()
        expect(entries).toHaveLength(1)
        expect(entries[0].hasSnapshot).toBe(true)

        const snapshots = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_item', (q) => q.eq('itemId', mapId))
          .collect()
        expect(snapshots).toHaveLength(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
