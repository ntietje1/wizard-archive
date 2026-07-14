import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import {
  createNoteViaFilesystem,
  createCanvasViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createGameMap,
  createNote,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { storeCommittedTestUploadSession } from '../../_test/storage.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate, makeYjsUpdateWithBlocks } from '../../_test/yjs.helper'
import { getEditHistoryEntryByUuid } from '../../_test/documentSnapshots.helper'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'
import type { PartialNoteBlock } from '@wizard-archive/editor/notes/document-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

describe('rollback permission checks', () => {
  const t = createTestContext()

  it('player with view-only access cannot rollback', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Protected Note',
        parentTarget: { kind: 'direct', parentId: null },
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
        playerAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!.historyEntryUuid,
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Private Note',
        parentTarget: { kind: 'direct', parentId: null },
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
        playerAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!.historyEntryUuid,
        }),
      )
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback error handling', () => {
  const t = createTestContext()

  it('rejects a nonexistent history entry explicitly', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const fakeId = await t.run(async (dbCtx) => {
      const historyEntryUuid = generateDomainId(DOMAIN_ID_KIND.historyEntry)
      const id = await dbCtx.db.insert('editHistory', {
        historyEntryUuid,
        itemId: noteId,
        itemType: 'note',
        campaignId: ctx.campaignId,
        campaignMemberId: ctx.dm.memberId,
        action: 'content_edited',
        metadata: null,
        hasSnapshot: false,
      })
      await dbCtx.db.delete('editHistory', id)
      return historyEntryUuid
    })

    const result = await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
      campaignId: ctx.campaignId,
      editHistoryId: fakeId,
    })
    expect(result).toEqual({ status: 'rejected', reason: 'history_entry_unavailable' })
  })

  it('rejects a history entry without a snapshot explicitly', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'No Snapshot Note',
        parentTarget: { kind: 'direct', parentId: null },
      })

      const historyEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'created'))
          .first()
      })

      expect(historyEntry).not.toBeNull()
      expect(historyEntry!.hasSnapshot).toBe(false)

      const result = await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!.historyEntryUuid,
      })
      expect(result).toEqual({ status: 'rejected', reason: 'snapshot_unavailable' })
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Rollback Content Note',
        parentTarget: { kind: 'direct', parentId: null },
      })

      const originalBlocks: Array<PartialNoteBlock> = [
        {
          id: testBlockNoteId('block-1'),
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

      const modifiedBlocks: Array<PartialNoteBlock> = [
        {
          id: testBlockNoteId('block-1'),
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

      const lastSeqBeforeRollback = await t.run(async (dbCtx) => {
        const latest = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
          .order('desc')
          .first()
        return latest?.seq ?? -1
      })
      const result = await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!.historyEntryUuid,
      })
      expect(result.status).toBe('restored')

      await expect(
        dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          campaignId: ctx.campaignId,
          documentId: noteId,
          revision: 0,
          update: modifiedUpdate,
        }),
      ).resolves.toEqual({ status: 'rejected', reason: 'revision_mismatch' })

      await t.run(async (dbCtx) => {
        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
          .collect()

        expect(updates).toHaveLength(1)
        expect(updates[0].isSnapshot).toBe(true)
        expect(updates[0].seq).toBeGreaterThan(lastSeqBeforeRollback)

        const state = await dbCtx.db
          .query('yjsDocumentStates')
          .withIndex('by_document', (q) => q.eq('documentId', noteId))
          .unique()
        expect(state?.revision).toBe(1)

        if (result.status !== 'restored') throw new Error('Expected rollback receipt')
        const preservedHistoryEntry = await getEditHistoryEntryByUuid(
          dbCtx.db,
          result.preservedHistoryEntryId,
        )
        const preservedSnapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) => q.eq('editHistoryId', preservedHistoryEntry!._id))
          .unique()
        const preservedDoc = new Y.Doc()
        Y.applyUpdate(preservedDoc, new Uint8Array(preservedSnapshot!.data))
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        expect(preservedDoc.getXmlFragment('document').toString()).toContain('Modified content')
        preservedDoc.destroy()

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

      const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Rollback Canvas',
        parentTarget: { kind: 'direct', parentId: null },
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

      const modifiedBlocks: Array<PartialNoteBlock> = [
        {
          id: testBlockNoteId('block-1'),
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

      const lastSeqBeforeRollback = await t.run(async (dbCtx) => {
        const latest = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', canvasId))
          .order('desc')
          .first()
        return latest?.seq ?? -1
      })
      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const updates = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', canvasId))
          .collect()

        expect(updates).toHaveLength(1)
        expect(updates[0].isSnapshot).toBe(true)
        expect(updates[0].seq).toBeGreaterThan(lastSeqBeforeRollback)

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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const sourceEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: sourceEntry!.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const rollbackEntry = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'rolled_back'))
          .first()

        expect(rollbackEntry).not.toBeNull()
        expect(rollbackEntry!.hasSnapshot).toBe(true)
        expect(rollbackEntry!.metadata).toEqual({
          restoredFromHistoryEntryId: sourceEntry!.historyEntryUuid,
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Timestamp Note',
        parentTarget: { kind: 'direct', parentId: null },
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

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!.historyEntryUuid,
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: n1, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: n2, x: 30, y: 40 }],
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

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: secondPinEntry.historyEntryUuid,
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: n1, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const firstEntry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: n2, x: 30, y: 40 }],
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

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: secondEntry.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const pins = await dbCtx.db
          .query('mapPins')
          .withIndex('by_map_item', (q) => q.eq('mapId', mapId))
          .collect()
        expect(pins).toHaveLength(2)
      })

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: firstEntry!.historyEntryUuid,
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      const entry = await t.run(async (dbCtx) => {
        return await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()
      })

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: entry!.historyEntryUuid,
      })
      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: entry!.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const rollbackEntries = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'rolled_back'))
          .collect()

        expect(rollbackEntries).toHaveLength(2)
        for (const rb of rollbackEntries) {
          expect(rb.metadata).toEqual({
            restoredFromHistoryEntryId: entry!.historyEntryUuid,
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

      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
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

      const { sessionId: newUploadSessionId } = await storeCommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['different-image'], { type: 'image/png' }),
        'map.png',
      )

      const replacementToken = await dmAuth.mutation(
        api.gameMaps.mutations.beginMapImageReplacement,
        { campaignId: ctx.campaignId, mapId },
      )
      await dmAuth.mutation(api.gameMaps.mutations.updateMapImage, {
        campaignId: ctx.campaignId,
        mapId,
        replacementToken,
        uploadSessionId: newUploadSessionId,
      })

      await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .first()
        expect(ext!.imageStorageId).not.toBe(snapshotData.imageAssetId ?? null)
      })

      await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: snapshotEntry!.historyEntryUuid,
      })

      await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .first()
        expect(ext!.imageStorageId).toBe(snapshotData.imageAssetId ?? null)
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
