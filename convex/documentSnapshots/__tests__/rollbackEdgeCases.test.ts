import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotFound, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import {
  makeYjsUpdate,
  makeYjsUpdateWithBlocks,
} from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import type { GameMapSnapshotData } from '../../gameMaps/types'

describe('rollback permission checks', () => {
  const t = createTestContext()

  it('player with view-only access cannot rollback', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Protected Note',
        parentId: null,
      })

      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'view',
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'content_edited'))
          .first()
      })

      await expectPermissionDenied(
        playerAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!._id,
        }),
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('player with no access cannot rollback', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Private Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'content_edited'))
          .first()
      })

      await expectPermissionDenied(
        playerAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!._id,
        }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback error handling', () => {
  const t = createTestContext()

  it('throws NOT_FOUND for nonexistent history entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const fakeId = await t.run(async (dbCtx) => {
      const id = await dbCtx.db.insert('editHistory', {
        itemId: noteId,
        itemType: 'note',
        campaignId: ctx.campaignId,
        campaignMemberId: ctx.dm.memberId,
        action: 'content_edited',
        metadata: null,
        hasSnapshot: false,
      })
      await dbCtx.db.delete('editHistory', id)
      return id
    })

    await expectNotFound(
      dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: fakeId,
      }),
    )
  })

  it('throws NOT_FOUND when history entry has no snapshot', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'No Snapshot Note',
        parentId: null,
      })

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'created'))
          .first()
      })

      expect(historyEntry).not.toBeNull()
      expect(historyEntry!.hasSnapshot).toBe(false)

      await expectNotFound(
        dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!._id,
        }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('note rollback data integrity', () => {
  const t = createTestContext()

  it('rollback restores note Yjs content to snapshot state', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Rollback Content Note',
        parentId: null,
      })

      const originalBlocks = [
        {
          id: 'block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Original content' }],
          props: {},
          children: [],
        },
      ]
      const originalUpdate = makeYjsUpdateWithBlocks(originalBlocks)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: originalUpdate,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const snapshotEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'content_edited'))
          .first()
      })
      expect(snapshotEntry!.hasSnapshot).toBe(true)

      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      const modifiedBlocks = [
        {
          id: 'block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Modified content' }],
          props: {},
          children: [],
        },
      ]
      const modifiedUpdate = makeYjsUpdateWithBlocks(modifiedBlocks)

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: modifiedUpdate,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
          .collect()

        expect(updates).toHaveLength(1)
        expect(updates[0].isSnapshot).toBe(true)
        expect(updates[0].seq).toBe(0)

        const doc = new Y.Doc()
        Y.applyUpdate(doc, new Uint8Array(updates[0].update))
        const fragment = doc.getXmlFragment('document')
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        expect(fragment.toString()).toContain('Original content')
        doc.destroy()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('canvas rollback data integrity', () => {
  const t = createTestContext()

  it('rollback restores canvas Yjs content to snapshot state', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { canvasId } = await dmAuth.mutation(api.canvases.mutations.createCanvas, {
        campaignId: ctx.campaignId,
        name: 'Rollback Canvas',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: canvasId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const snapshotEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) =>
            q.eq('itemId', canvasId).eq('action', 'content_edited'),
          )
          .first()
      })
      expect(snapshotEntry!.hasSnapshot).toBe(true)

      const originalDoc = new Y.Doc()
      await t.run(async (dbCtx) => {
        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', canvasId))
          .collect()
        for (const u of updates) {
          Y.applyUpdate(originalDoc, new Uint8Array(u.update))
        }
      })
      const originalSv = Y.encodeStateVector(originalDoc)
      originalDoc.destroy()

      vi.advanceTimersByTime(5 * 60 * 1000 + 1)

      const modifiedBlocks = [
        {
          id: 'block-1',
          type: 'paragraph',
          content: [{ type: 'text', text: 'Modified canvas content' }],
          props: {},
          children: [],
        },
      ]
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: canvasId,
        update: makeYjsUpdateWithBlocks(modifiedBlocks),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', canvasId))
          .collect()

        expect(updates).toHaveLength(1)
        expect(updates[0].isSnapshot).toBe(true)
        expect(updates[0].seq).toBe(0)

        const restoredDoc = new Y.Doc()
        Y.applyUpdate(restoredDoc, new Uint8Array(updates[0].update))
        const restoredSv = Y.encodeStateVector(restoredDoc)
        const fragment = restoredDoc.getXmlFragment('document')
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        expect(fragment.toString()).not.toContain('Modified canvas content')
        expect(Array.from(restoredSv)).toEqual(Array.from(originalSv))
        restoredDoc.destroy()
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback metadata integrity', () => {
  const t = createTestContext()

  it('rolled_back history entry references the source entry', async () => {
    vi.useFakeTimers()
    try {
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
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const sourceEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: sourceEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const rollbackEntry = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'rolled_back'))
          .first()

        expect(rollbackEntry).not.toBeNull()
        expect(rollbackEntry!.hasSnapshot).toBe(false)
        expect(rollbackEntry!.metadata).toEqual({
          restoredFromHistoryEntryId: sourceEntry!._id,
        })
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rollback updates the item updatedTime and updatedBy', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Timestamp Note',
        parentId: null,
      })

      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignId,
        documentId: noteId,
        update: makeYjsUpdate(),
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'content_edited'))
          .first()
      })

      const beforeRollback = await t.run(async (dbCtx) => {
        return await dbCtx.db.get('sidebarItems', noteId)
      })

      vi.advanceTimersByTime(1000)

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const afterRollback = await dbCtx.db.get('sidebarItems', noteId)
        expect(afterRollback!.updatedTime).toBeGreaterThan(beforeRollback!.updatedTime ?? 0)
        expect(afterRollback!.updatedBy).toBe(ctx.dm.profile._id)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('map rollback with deleted pin targets', () => {
  const t = createTestContext()

  it('skips pins whose target items have been deleted', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 10,
        y: 20,
        itemId: n1,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 30,
        y: 40,
        itemId: n2,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const secondPinEntry = await t.run(async (dbCtx) => {
        const entries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .order('desc')
          .collect()
        return entries[0]
      })

      await t.run(async (dbCtx) => {
        await dbCtx.db.delete('sidebarItems', n1)
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: secondPinEntry._id,
      })

      await t.run(async (dbCtx) => {
        const pins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()

        expect(pins).toHaveLength(1)
        expect(pins[0].itemId).toBe(n2)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('sequential rollbacks', () => {
  const t = createTestContext()

  it('can rollback to an earlier snapshot after a previous rollback', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 10,
        y: 20,
        itemId: n1,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const firstEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.mutation(api.gameMaps.mutations.createItemPin, {
        campaignId: ctx.campaignId,
        mapId,
        x: 30,
        y: 40,
        itemId: n2,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const secondEntry = await t.run(async (dbCtx) => {
        const entries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .order('desc')
          .collect()
        return entries[0]
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: secondEntry._id,
      })

      await t.run(async (dbCtx) => {
        const pins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()
        expect(pins).toHaveLength(2)
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: firstEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const pins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()
        expect(pins).toHaveLength(1)
        expect(pins[0].itemId).toBe(n1)
        expect(pins[0].x).toBe(10)
        expect(pins[0].y).toBe(20)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('rollback history entries accumulate correctly', async () => {
    vi.useFakeTimers()
    try {
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
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const entry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: entry!._id,
      })
      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: entry!._id,
      })

      await t.run(async (dbCtx) => {
        const rollbackEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'rolled_back'))
          .collect()

        expect(rollbackEntries).toHaveLength(2)
        for (const rb of rollbackEntries) {
          expect(rb.metadata).toEqual({
            restoredFromHistoryEntryId: entry!._id,
          })
        }
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('map rollback restores image state', () => {
  const t = createTestContext()

  it('rollback restores map image to snapshot state', async () => {
    vi.useFakeTimers()
    try {
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
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const snapshotEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      const snapshot = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) => q.eq('editHistoryId', snapshotEntry!._id))
          .first()
      })

      const snapshotData: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))

      const newStorageId = await t.run(async (dbCtx) => {
        return await dbCtx.storage.store(new Blob(['different-image']))
      })

      await dmAuth.mutation(api.gameMaps.mutations.updateMap, {
        campaignId: ctx.campaignId,
        mapId,
        imageStorageId: newStorageId,
      })

      await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .first()
        expect(ext!.imageStorageId).not.toBe(snapshotData.imageStorageId ?? null)
      })

      await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!._id,
      })

      await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .first()
        expect(ext!.imageStorageId).toBe(snapshotData.imageStorageId ?? null)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
