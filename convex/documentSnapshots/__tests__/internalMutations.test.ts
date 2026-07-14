import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createCanvas, createGameMap, createMapPin, createNote } from '../../_test/factories.helper'
import { DOCUMENT_SNAPSHOT_TYPE } from '../types'
import type { LogEditHistoryArgs } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { makeYjsUpdate } from '../../_test/yjs.helper'
import { captureGameMapSnapshot } from '../../gameMaps/functions/captureGameMapSnapshot'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import type { GameMapSnapshotData } from '@wizard-archive/editor/game-maps/document-contract'
import {
  DOMAIN_ID_KIND,
  generateDomainId,
  isUuidV7,
} from '@wizard-archive/editor/resources/domain-id'

function createEditHistoryEntry(
  t: ReturnType<typeof createTestContext>,
  args: Omit<LogEditHistoryArgs, 'itemId'> & {
    itemId: Id<'sidebarItems'>
    campaignId: Id<'campaigns'>
    campaignMemberId: Id<'campaignMembers'>
    hasSnapshot: boolean
  },
) {
  return t.run(async (dbCtx) => {
    return await dbCtx.db.insert('editHistory', {
      historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
      itemId: args.itemId,
      itemType: args.itemType,
      campaignId: args.campaignId,
      campaignMemberId: args.campaignMemberId,
      action: args.action,
      metadata: args.metadata ?? null,
      hasSnapshot: args.hasSnapshot,
    })
  })
}

describe('document snapshot schema invariants', () => {
  const t = createTestContext()

  it('rejects incompatible item and snapshot variants', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: noteRowId,
      itemType: RESOURCE_TYPES.notes,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: false,
    })

    await expect(
      t.run(async (dbCtx) =>
        dbCtx.db.insert('documentSnapshots', {
          snapshotUuid: generateDomainId(DOMAIN_ID_KIND.snapshot),
          itemId: noteRowId,
          itemType: RESOURCE_TYPES.notes,
          editHistoryId,
          campaignId: ctx.campaignId,
          snapshotType: DOCUMENT_SNAPSHOT_TYPE.GameMap,
          data: new ArrayBuffer(0),
        } as never),
      ),
    ).rejects.toThrow('Validator error')
  })
})

describe('captureCanvasSnapshot', () => {
  const t = createTestContext()

  it('captures Y.Doc state for a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const { canvasRowId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const yjsUpdate = makeYjsUpdate()
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: canvasRowId,
        update: yjsUpdate,
        seq: 0,
        isSnapshot: true,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: canvasRowId,
      itemType: RESOURCE_TYPES.canvases,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: false,
    })

    const captureArgs = {
      documentId: canvasRowId,
      itemType: RESOURCE_TYPES.canvases,
      editHistoryId,
      campaignId: ctx.campaignId,
      expectedRevision: 0,
      maxSeq: 0,
    } as const
    const firstCapture = await t.action(
      internal.yjsSync.internalActions.captureSnapshot,
      captureArgs,
    )
    const repeatedCapture = await t.action(
      internal.yjsSync.internalActions.captureSnapshot,
      captureArgs,
    )
    expect(repeatedCapture).toEqual(firstCapture)

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(isUuidV7(snapshot!.snapshotUuid)).toBe(true)
      expect(snapshot!.snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.YjsState)
      expect(snapshot!.itemId).toBe(canvasRowId)
      expect(snapshot!.itemType).toBe(RESOURCE_TYPES.canvases)

      const expectedDoc = new Y.Doc()
      Y.applyUpdate(expectedDoc, new Uint8Array(yjsUpdate))
      const expectedSV = Y.encodeStateVector(expectedDoc)
      expectedDoc.destroy()

      const doc = new Y.Doc()
      Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
      const sv = Y.encodeStateVector(doc)
      expect(sv).toEqual(expectedSV)
      doc.destroy()
    })
  })

  it('merges multiple yjs updates into snapshot', async () => {
    const ctx = await setupCampaignContext(t)
    const { canvasRowId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const originalDoc = new Y.Doc()
    const fragment = originalDoc.getXmlFragment('document')
    const initialUpdate = Y.encodeStateAsUpdate(originalDoc)
    const initialAb = initialUpdate.buffer.slice(
      initialUpdate.byteOffset,
      initialUpdate.byteOffset + initialUpdate.byteLength,
    ) as ArrayBuffer

    const sv = Y.encodeStateVector(originalDoc)
    fragment.insert(0, [new Y.XmlText('test content')])
    const modUpdate = Y.encodeStateAsUpdate(originalDoc, sv)
    const modAb = modUpdate.buffer.slice(
      modUpdate.byteOffset,
      modUpdate.byteOffset + modUpdate.byteLength,
    ) as ArrayBuffer

    const expectedSV = Y.encodeStateVector(originalDoc)
    originalDoc.destroy()

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: canvasRowId,
        update: initialAb,
        seq: 0,
        isSnapshot: true,
      })
      await dbCtx.db.insert('yjsUpdates', {
        documentId: canvasRowId,
        update: modAb,
        seq: 1,
        isSnapshot: false,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: canvasRowId,
      itemType: RESOURCE_TYPES.canvases,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: false,
    })

    await t.action(internal.yjsSync.internalActions.captureSnapshot, {
      documentId: canvasRowId,
      itemType: RESOURCE_TYPES.canvases,
      editHistoryId,
      campaignId: ctx.campaignId,
      expectedRevision: 0,
      maxSeq: 1,
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      const reconstructed = new Y.Doc()
      Y.applyUpdate(reconstructed, new Uint8Array(snapshot!.data))
      const reconstructedSV = Y.encodeStateVector(reconstructed)
      reconstructed.destroy()

      expect(reconstructedSV).toEqual(expectedSV)
    })
  })
})

describe('captureNoteSnapshot', () => {
  const t = createTestContext()

  it('captures Y.Doc state for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const yjsUpdate = makeYjsUpdate()
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteRowId,
        update: yjsUpdate,
        seq: 0,
        isSnapshot: true,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: noteRowId,
      itemType: RESOURCE_TYPES.notes,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: false,
    })

    await t.action(internal.yjsSync.internalActions.captureSnapshot, {
      documentId: noteRowId,
      itemType: RESOURCE_TYPES.notes,
      editHistoryId,
      campaignId: ctx.campaignId,
      expectedRevision: 0,
      maxSeq: 0,
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.YjsState)
      expect(snapshot!.itemId).toBe(noteRowId)
      expect(snapshot!.itemType).toBe(RESOURCE_TYPES.notes)

      const expectedDoc = new Y.Doc()
      Y.applyUpdate(expectedDoc, new Uint8Array(yjsUpdate))
      const expectedSV = Y.encodeStateVector(expectedDoc)
      expectedDoc.destroy()

      const doc = new Y.Doc()
      Y.applyUpdate(doc, new Uint8Array(snapshot!.data))
      const sv = Y.encodeStateVector(doc)
      expect(sv).toEqual(expectedSV)
      doc.destroy()
    })
  })
})

describe('scheduled Yjs snapshot ownership', () => {
  const t = createTestContext()

  it('rejects final capture after its item is hard-deleted', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteRowId,
        update: makeYjsUpdate(),
        seq: 0,
        isSnapshot: true,
      })
    })
    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: noteRowId,
      itemType: RESOURCE_TYPES.notes,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: false,
    })
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteRowId)
    })

    await expect(
      t.action(internal.yjsSync.internalActions.captureSnapshot, {
        documentId: noteRowId,
        itemType: RESOURCE_TYPES.notes,
        editHistoryId,
        campaignId: ctx.campaignId,
        expectedRevision: 0,
        maxSeq: 0,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'item_unavailable' })
    await t.run(async (dbCtx) => {
      const snapshots = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .collect()
      expect(snapshots).toEqual([])
      expect(await dbCtx.db.get('editHistory', editHistoryId)).toBeNull()
    })
  })

  it('deletes item history and snapshots in fixed-size scheduled batches', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const { noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      await t.run(async (dbCtx) => {
        for (let index = 0; index < 125; index++) {
          const editHistoryId = await dbCtx.db.insert('editHistory', {
            historyEntryUuid: generateDomainId(DOMAIN_ID_KIND.historyEntry),
            itemId: noteRowId,
            itemType: RESOURCE_TYPES.notes,
            campaignId: ctx.campaignId,
            campaignMemberId: ctx.dm.memberId,
            action: 'content_edited',
            metadata: null,
            hasSnapshot: true,
          })
          await dbCtx.db.insert('documentSnapshots', {
            snapshotUuid: generateDomainId(DOMAIN_ID_KIND.snapshot),
            itemId: noteRowId,
            itemType: RESOURCE_TYPES.notes,
            editHistoryId,
            campaignId: ctx.campaignId,
            snapshotType: DOCUMENT_SNAPSHOT_TYPE.YjsState,
            data: new ArrayBuffer(0),
          })
        }
      })

      const firstBatch = await t.mutation(
        internal.documentSnapshots.internalMutations.cleanupItemHistoryBatch,
        { itemId: noteRowId },
      )
      expect(firstBatch).toEqual({
        deletedHistoryCount: 100,
        deletedSnapshotCount: 100,
        hasMore: true,
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        expect(
          await dbCtx.db
            .query('editHistory')
            .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
            .collect(),
        ).toEqual([])
        expect(
          await dbCtx.db
            .query('documentSnapshots')
            .withIndex('by_item', (q) => q.eq('itemId', noteRowId))
            .collect(),
        ).toEqual([])
      })
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('captureGameMapSnapshot', () => {
  const t = createTestContext()

  it('captures map image and pin data', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, {
      itemId: noteId,
      x: 10,
      y: 20,
      visible: true,
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId: mapRowId,
        editHistoryId,
        campaignId: ctx.campaignId,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(DOCUMENT_SNAPSHOT_TYPE.GameMap)
      expect(snapshot!.itemId).toBe(mapRowId)

      const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))
      expect(parsed.imageAssetId).toBeNull()
      expect(parsed.pins).toHaveLength(1)
      expect(parsed.pins[0].x).toBe(10)
      expect(parsed.pins[0].y).toBe(20)
      expect(parsed.pins[0].visible).toBe(true)
      expect(parsed.pins[0].itemId).toBe(noteId)
      expect(parsed.pins[0].name).toEqual(expect.any(String))
      expect(parsed.pins[0].color).toBeNull()
      expect(parsed.pins[0].iconName).toBeNull()
      expect(parsed.pins[0].itemType).toBe('note')
    })
  })

  it('excludes hard-deleted pins', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: note1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: note2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, {
      itemId: note1,
      x: 0,
      y: 0,
      visible: true,
    })
    const { pinId: pin2 } = await createMapPin(t, mapId, {
      itemId: note2,
      x: 50,
      y: 50,
      visible: false,
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('mapPins', pin2)
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_removed',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId: mapRowId,
        editHistoryId,
        campaignId: ctx.campaignId,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))
      expect(parsed.pins).toHaveLength(1)
      expect(parsed.pins[0].itemId).toBe(note1)
      expect(parsed.pins[0].name).toEqual(expect.any(String))
      expect(parsed.pins[0].color).toBeNull()
      expect(parsed.pins[0].iconName).toBeNull()
      expect(parsed.pins[0].itemType).toBe('note')
    })
  })

  it('throws when map does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', mapRowId)
    })

    await expect(
      t.run(async (dbCtx) => {
        await captureGameMapSnapshot(dbCtx, {
          mapId: mapRowId,
          editHistoryId,
          campaignId: ctx.campaignId,
        })
      }),
    ).rejects.toThrow(/sidebarItem not found for mapId/)
  })

  it('captures empty pin array when map has no pins', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_image_changed',
      hasSnapshot: true,
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId: mapRowId,
        editHistoryId,
        campaignId: ctx.campaignId,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))
      expect(parsed.pins).toEqual([])
    })
  })

  it('captures multiple pins with correct positions', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n3 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, {
      itemId: n1,
      x: 100,
      y: 200,
      visible: true,
    })
    await createMapPin(t, mapId, {
      itemId: n2,
      x: 300,
      y: 400,
      visible: false,
    })
    await createMapPin(t, mapId, {
      itemId: n3,
      x: 500,
      y: 600,
      visible: true,
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapRowId,
      itemType: RESOURCE_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId: mapRowId,
        editHistoryId,
        campaignId: ctx.campaignId,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))
      expect(parsed.pins).toHaveLength(3)

      const pinsByItem = new Map(parsed.pins.map((p) => [p.itemId, p]))
      expect(pinsByItem.get(n1)).toMatchObject({
        x: 100,
        y: 200,
        visible: true,
      })
      expect(pinsByItem.get(n2)).toMatchObject({
        x: 300,
        y: 400,
        visible: false,
      })
      expect(pinsByItem.get(n3)).toMatchObject({
        x: 500,
        y: 600,
        visible: true,
      })
    })
  })
})
