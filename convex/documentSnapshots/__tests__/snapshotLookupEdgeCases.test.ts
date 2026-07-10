import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createGameMap, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate } from '../../_test/yjs.helper'
import { storeUncommittedTestUploadSession } from '../../_test/storage.helper'

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

  it('getHistoryPreview returns product content when hasSnapshot is true', async () => {
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

      const snapshot = await dmAuth.query(api.documentSnapshots.queries.getHistoryPreview, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!._id,
      })

      expect(snapshot).not.toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves map snapshot media for an editor who did not upload it', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const playerAuth = asPlayer(ctx)
      const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
      await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: mapId,
        sidebarItemType: 'gameMap',
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'edit',
      })
      const upload = await storeUncommittedTestUploadSession(
        t,
        ctx.dm.profile._id,
        new Blob(['map-image'], { type: 'image/png' }),
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
        uploadSessionId: upload.sessionId,
      })
      const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
      await dmAuth.mutation(api.gameMaps.mutations.createItemPins, {
        campaignId: ctx.campaignId,
        mapId,
        pins: [{ itemId: noteId, x: 10, y: 20 }],
      })
      await t.finishAllScheduledFunctions(vi.runAllTimers)
      const historyEntry = await t.run(async (dbCtx) =>
        dbCtx.db
          .query('editHistory')
          .withIndex('by_item_action', (q) => q.eq('itemId', mapId).eq('action', 'map_pin_added'))
          .first(),
      )

      expect(historyEntry?.hasSnapshot).toBe(true)
      await expect(
        playerAuth.query(api.documentSnapshots.queries.getHistoryPreview, {
          campaignId: ctx.campaignId,
          editHistoryId: historyEntry!._id,
        }),
      ).resolves.toMatchObject({
        kind: 'game-map',
        imageUrlState: { status: 'ready', url: expect.any(String) },
      })
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

  it('rejects a nonexistent editHistoryId explicitly', async () => {
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

    const result = await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
      campaignId: ctx.campaignId,
      editHistoryId: fakeId,
    })
    expect(result).toEqual({ status: 'rejected', reason: 'history_entry_unavailable' })
  })

  it('getHistoryPreview returns null when hasSnapshot is false', async () => {
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

    const snapshot = await dmAuth.query(api.documentSnapshots.queries.getHistoryPreview, {
      campaignId: ctx.campaignId,
      editHistoryId: historyEntry!._id,
    })

    expect(snapshot).toBeNull()
  })

  it('rejects a snapshot whose item identity does not match its history entry', async () => {
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Snapshot Target',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const { noteId: otherNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      update: makeYjsUpdate(),
    })
    await t.finishAllScheduledFunctions(vi.runAllTimers)

    const historyEntry = await t.run(async (dbCtx) => {
      const entry = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'content_edited'))
        .first()
      const snapshot = await dbCtx.db
        .query('documentSnapshots')
        .withIndex('by_editHistory', (q) => q.eq('editHistoryId', entry!._id))
        .unique()
      await dbCtx.db.patch('documentSnapshots', snapshot!._id, { itemId: otherNoteId })
      return entry!
    })

    await expect(
      dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry._id,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'snapshot_incompatible' })
    await expect(
      dmAuth.query(api.documentSnapshots.queries.getHistoryPreview, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry._id,
      }),
    ).resolves.toEqual({ kind: 'unsupported' })
  })

  it('rejects direct snapshot reads for view-only users', async () => {
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'View Only Snapshot Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const historyEntry = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) => q.eq('itemId', noteId).eq('action', 'created'))
        .first()
    })
    expect(historyEntry).not.toBeNull()

    await expectPermissionDenied(
      playerAuth.query(api.documentSnapshots.queries.getHistoryPreview, {
        campaignId: ctx.campaignId,
        editHistoryId: historyEntry!._id,
      }),
    )
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

    const result = await dmAuth.action(api.documentSnapshots.actions.rollbackToSnapshot, {
      campaignId: ctx.campaignId,
      editHistoryId: snapshotEntry!._id,
    })

    expect(result.status).toBe('restored')
  })
})
