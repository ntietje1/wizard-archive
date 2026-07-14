import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createCanvasViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFile,
  createFolder,
  createGameMap,
  createNote,
  createSidebarShare,
  executeMoveCommand,
  getSidebarItemRowId,
} from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate as makeEmptyYjsUpdate } from '../../_test/yjs.helper'
import { testSessionId } from '../../../shared/test/session-id'

const COMPACTION_SEQ = 20
const AWARENESS_SESSION_ID = testSessionId('awareness-session-1')

function makeAwarenessState(): ArrayBuffer {
  return new Uint8Array([1, 2, 3, 4]).buffer
}

describe('pushUpdate', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('player without share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('DM can push update and gets correct seq back', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Test Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(result).toEqual({ status: 'accepted', seq: 1 })
  })

  it('increments seq correctly across multiple pushes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Test Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const r1 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    const r2 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    const r3 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(r1).toEqual({ status: 'accepted', seq: 1 })
    expect(r2).toEqual({ status: 'accepted', seq: 2 })
    expect(r3).toEqual({ status: 'accepted', seq: 3 })
  })

  it('player with edit share can push update', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Shared Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(result).toEqual({ status: 'accepted', seq: 1 })
  })

  it('player with view-only share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'View Only Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('returns NOT_FOUND for nonexistent note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteRowId)
    })

    await expectNotFound(
      dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('rejects non-Yjs sidebar item types', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    for (const documentId of [folderId, fileId, mapId]) {
      await expectValidationFailed(
        dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          campaignId: ctx.campaignDomainId,
          documentId,
          update: makeEmptyYjsUpdate(),
        }),
      )
    }
  })

  it('rejects updates while a note is trashed and accepts them after restore', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Lifecycle Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    const result = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(result).toEqual({ status: 'accepted', seq: 1 })
  })

  it('defers compaction while a content snapshot is pending', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await createNoteViaFilesystem(dmAuth, {
        campaignId: ctx.campaignDomainId,
        name: 'Compact Note',
        parentTarget: { kind: 'direct', parentId: null },
      })
      const noteRowId = await getSidebarItemRowId(t, noteId)

      for (let i = 1; i <= COMPACTION_SEQ; i++) {
        await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          campaignId: ctx.campaignDomainId,
          documentId: noteId,
          update: makeEmptyYjsUpdate(),
        })
      }

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const rows = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
          .collect()

        expect(rows.length).toBeGreaterThan(1)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not trigger compaction before interval', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'No Compact Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    for (let i = 1; i < COMPACTION_SEQ; i++) {
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      })
    }

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
        .collect()

      expect(rows).toHaveLength(20)
    })
  })
})

describe('pushAwareness', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 1,
        sessionId: AWARENESS_SESSION_ID,
        state: makeAwarenessState(),
      }),
    )
  })

  it('player without share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 1,
        sessionId: AWARENESS_SESSION_ID,
        state: makeAwarenessState(),
      }),
    )
  })

  it('rejects awareness for non-Yjs sidebar item types', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)

    for (const documentId of [folderId, fileId, mapId]) {
      await expectValidationFailed(
        dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
          campaignId: ctx.campaignDomainId,
          documentId,
          clientId: 1,
          sessionId: AWARENESS_SESSION_ID,
          state: makeAwarenessState(),
        }),
      )
    }
  })

  it('DM can push awareness state', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    const state = makeAwarenessState()

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 42,
      sessionId: AWARENESS_SESSION_ID,
      state,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 42))
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].documentId).toBe(noteRowId)
      expect(rows[0].clientId).toBe(42)
      expect(rows[0].userId).toBe(ctx.dm.profile._id)
    })
  })

  it('rejects awareness while a canvas is trashed and accepts it after restore', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Lifecycle Canvas',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const canvasRowId = await getSidebarItemRowId(t, canvasId)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [canvasId],
      targetParentId: null,
      action: 'trash',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: canvasId,
        clientId: 7,
        sessionId: AWARENESS_SESSION_ID,
        state: makeAwarenessState(),
      }),
    )

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [canvasId],
      targetParentId: null,
      action: 'restore',
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: canvasId,
      clientId: 7,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', canvasRowId).eq('clientId', 7))
        .collect()

      expect(rows).toHaveLength(1)
    })
  })

  it('upserts existing awareness entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Upsert Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 10,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    const newState = new Uint8Array([5, 6, 7, 8]).buffer
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 10,
      sessionId: AWARENESS_SESSION_ID,
      state: newState,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 10))
        .collect()

      expect(rows).toHaveLength(1)
    })
  })

  it('creates separate entries for different clientIds', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Multi Client Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 1,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 2,
      sessionId: testSessionId('awareness-session-2'),
      state: makeAwarenessState(),
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteRowId))
        .collect()

      expect(rows).toHaveLength(2)
    })
  })

  it('player with view share can push awareness', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'View Share Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await playerAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 99,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 99))
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].userId).toBe(ctx.player.profile._id)
    })
  })

  it('rejects a different user or session taking over an existing client id', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Owned Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    const originalState = makeAwarenessState()
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 50,
      sessionId: AWARENESS_SESSION_ID,
      state: originalState,
    })

    await expect(
      playerAuth.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 50,
        sessionId: testSessionId('attacker-session'),
        state: new Uint8Array([9]).buffer,
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'session_conflict' })

    await t.run(async (dbCtx) => {
      const row = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 50))
        .unique()
      expect(row?.userId).toBe(ctx.dm.profile._id)
      expect(row?.sessionId).toBe(AWARENESS_SESSION_ID)
      expect(row?.state).toEqual(originalState)
    })
  })

  it('rejects awareness writes without session ownership', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expect(
      dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 51,
        state: makeAwarenessState(),
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'session_required' })
  })
})

describe('removeAwareness', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.yjsSync.mutations.removeAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 1,
        sessionId: AWARENESS_SESSION_ID,
      }),
    )
  })

  it('removes existing awareness entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Remove Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 5,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 5,
      sessionId: AWARENESS_SESSION_ID,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 5))
        .collect()

      expect(rows).toHaveLength(0)
    })
  })

  it('no-op when awareness entry does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'No-op Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 999,
      sessionId: AWARENESS_SESSION_ID,
    })

    expect(result).toEqual({ status: 'unavailable' })
  })

  it('only removes matching clientId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Selective Remove Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 1,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 2,
      sessionId: testSessionId('awareness-session-2'),
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 1,
      sessionId: AWARENESS_SESSION_ID,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteRowId))
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].clientId).toBe(2)
    })
  })

  it('rejects release from a different awareness session', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Session Release Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 52,
      sessionId: AWARENESS_SESSION_ID,
      state: makeAwarenessState(),
    })

    await expect(
      dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId: 52,
        sessionId: testSessionId('different-session'),
      }),
    ).resolves.toEqual({ status: 'rejected', reason: 'session_conflict' })

    await t.run(async (dbCtx) => {
      const row = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) => q.eq('documentId', noteRowId).eq('clientId', 52))
        .unique()
      expect(row).not.toBeNull()
    })
  })
})
