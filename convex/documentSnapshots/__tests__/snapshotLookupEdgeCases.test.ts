import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote } from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate } from '../../_test/yjs.helper'

describe('snapshot exists when history entry claims hasSnapshot=true', () => {
  const t = createTestContext()

  it('snapshot should exist when history entry claims hasSnapshot=true', async () => {
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

      // Run scheduled functions so the async snapshot is created
      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const history = await dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first()

        expect(history).not.toBeNull()
        expect(history!.hasSnapshot).toBe(true)

        const snapshot = await dbCtx.db
          .query('documentSnapshots')
          .withIndex('by_editHistory', (q) => q.eq('editHistoryId', history!._id))
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

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignId,
        name: 'Async Race Note',
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

      expect(historyEntry).not.toBeNull()
      expect(historyEntry!.hasSnapshot).toBe(true)

      const snapshot = await dmAuth.query(
        api.documentSnapshots.queries.getSnapshotForHistoryEntry,
        { campaignId: ctx.campaignId, editHistoryId: historyEntry!._id },
      )

      expect(snapshot).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('rollback edge cases', () => {
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

  it('throws NOT_FOUND for nonexistent editHistoryId', async () => {
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

  it('getSnapshotForHistoryEntry returns null when hasSnapshot is false', async () => {
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

    const snapshot = await dmAuth.query(api.documentSnapshots.queries.getSnapshotForHistoryEntry, {
      campaignId: ctx.campaignId,
      editHistoryId: historyEntry!._id,
    })

    expect(snapshot).toBeNull()
  })

  it('rollback of soft-deleted item does not throw', async () => {
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
    expect(snapshotEntry!.hasSnapshot).toBe(true)

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', mapId, {
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    const result = await dmAuth.mutation(api.documentSnapshots.mutations.rollbackToSnapshot, {
      campaignId: ctx.campaignId,
      editHistoryId: snapshotEntry!._id,
    })

    expect(result).toBeNull()
  })
})
