import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { setupCampaignContext } from '../../_test/identities.helper'
import { createCanvas, createGameMap, createMapPin, createNote } from '../../_test/factories.helper'
import { SNAPSHOT_TYPE } from '../schema'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { makeYjsUpdate } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import { captureCanvasSnapshot } from '../../canvases/functions/captureCanvasSnapshot'
import { captureNoteSnapshot } from '../../notes/functions/captureNoteSnapshot'
import { captureGameMapSnapshot } from '../../gameMaps/functions/captureGameMapSnapshot'
import type { LogEditHistoryArgs } from '../../editHistory/types'
import type { Id } from '../../_generated/dataModel'
import type { GameMapSnapshotData } from '../../gameMaps/types'

function createEditHistoryEntry(
  t: ReturnType<typeof createTestContext>,
  args: LogEditHistoryArgs & {
    campaignMemberId: Id<'campaignMembers'>
    hasSnapshot: boolean
  },
) {
  return t.run(async (dbCtx) => {
    return await dbCtx.db.insert('editHistory', {
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

describe('captureCanvasSnapshot', () => {
  const t = createTestContext()

  it('captures Y.Doc state for a canvas', async () => {
    const ctx = await setupCampaignContext(t)
    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

    const yjsUpdate = makeYjsUpdate()
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: canvasId,
        update: yjsUpdate,
        seq: 0,
        isSnapshot: true,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: canvasId,
      itemType: SIDEBAR_ITEM_TYPES.canvases,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: true,
    })

    await t.run(async (dbCtx) => {
      await captureCanvasSnapshot(dbCtx, {
        canvasId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
      expect(snapshot!.itemId).toBe(canvasId)
      expect(snapshot!.itemType).toBe(SIDEBAR_ITEM_TYPES.canvases)
      expect(snapshot!.createdBy).toBe(ctx.dm.profile._id)

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
    const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)

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
        documentId: canvasId,
        update: initialAb,
        seq: 0,
        isSnapshot: true,
      })
      await dbCtx.db.insert('yjsUpdates', {
        documentId: canvasId,
        update: modAb,
        seq: 1,
        isSnapshot: false,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: canvasId,
      itemType: SIDEBAR_ITEM_TYPES.canvases,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: true,
    })

    await t.run(async (dbCtx) => {
      await captureCanvasSnapshot(dbCtx, {
        canvasId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
      })
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
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const yjsUpdate = makeYjsUpdate()
    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('yjsUpdates', {
        documentId: noteId,
        update: yjsUpdate,
        seq: 0,
        isSnapshot: true,
      })
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: noteId,
      itemType: SIDEBAR_ITEM_TYPES.notes,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'content_edited',
      hasSnapshot: true,
    })

    await t.run(async (dbCtx) => {
      await captureNoteSnapshot(dbCtx, {
        noteId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.yjs_state)
      expect(snapshot!.itemId).toBe(noteId)
      expect(snapshot!.itemType).toBe(SIDEBAR_ITEM_TYPES.notes)

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

describe('captureGameMapSnapshot', () => {
  const t = createTestContext()

  it('captures map image and pin data', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: noteId,
      x: 10,
      y: 20,
      visible: true,
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
      })
    })

    await t.run(async (dbCtx) => {
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', editHistoryId))
        .first()

      expect(snapshot).not.toBeNull()
      expect(snapshot!.snapshotType).toBe(SNAPSHOT_TYPE.game_map)
      expect(snapshot!.itemId).toBe(mapId)
      expect(snapshot!.createdBy).toBe(ctx.dm.profile._id)

      const parsed: GameMapSnapshotData = JSON.parse(new TextDecoder().decode(snapshot!.data))
      expect(parsed.imageStorageId).toBeNull()
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

  it('excludes soft-deleted pins', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: note1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: note2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: note1,
      x: 0,
      y: 0,
      visible: true,
    })
    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: note2,
      x: 50,
      y: 50,
      visible: false,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_removed',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
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
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', mapId)
    })

    await expect(
      t.run(async (dbCtx) => {
        await captureGameMapSnapshot(dbCtx, {
          mapId,
          editHistoryId,
          campaignId: ctx.campaignId,
          createdBy: ctx.dm.profile._id,
        })
      }),
    ).rejects.toThrow(/map .* not found/)
  })

  it('captures empty pin array when map has no pins', async () => {
    const ctx = await setupCampaignContext(t)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_image_changed',
      hasSnapshot: true,
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
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
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n3 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: n1,
      x: 100,
      y: 200,
      visible: true,
    })
    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: n2,
      x: 300,
      y: 400,
      visible: false,
    })
    await createMapPin(t, mapId, ctx.dm.profile._id, {
      itemId: n3,
      x: 500,
      y: 600,
      visible: true,
    })

    const editHistoryId = await createEditHistoryEntry(t, {
      itemId: mapId,
      itemType: SIDEBAR_ITEM_TYPES.gameMaps,
      campaignId: ctx.campaignId,
      campaignMemberId: ctx.dm.memberId,
      action: 'map_pin_added',
      hasSnapshot: true,
      metadata: { pinItemName: 'test' },
    })

    await t.run(async (dbCtx) => {
      await captureGameMapSnapshot(dbCtx, {
        mapId,
        editHistoryId,
        campaignId: ctx.campaignId,
        createdBy: ctx.dm.profile._id,
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
