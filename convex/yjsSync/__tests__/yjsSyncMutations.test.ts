import { describe, expect, it, vi } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
} from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate as makeEmptyYjsUpdate } from './makeYjsUpdate.helper'

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
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('DM can push update and gets correct seq back', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Test Note',
      parentId: null,
    })

    const result = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(result).toEqual({ seq: 1 })
  })

  it('increments seq correctly across multiple pushes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Test Note',
      parentId: null,
    })

    const r1 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    const r2 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    const r3 = await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(r1).toEqual({ seq: 1 })
    expect(r2).toEqual({ seq: 2 })
    expect(r3).toEqual({ seq: 3 })
  })

  it('player with edit share can push update', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Shared Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await playerAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    expect(result).toEqual({ seq: 1 })
  })

  it('player with view-only share is denied', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'View Only Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('returns NOT_FOUND for nonexistent note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete(noteId)
    })

    await expectNotFound(
      dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      }),
    )
  })

  it('triggers compaction at COMPACT_INTERVAL', async () => {
    vi.useFakeTimers()
    try {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Compact Note',
        parentId: null,
      })

      for (let i = 1; i <= 20; i++) {
        await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
          documentId: noteId,
          update: makeEmptyYjsUpdate(),
        })
      }

      await t.finishAllScheduledFunctions(vi.runAllTimers)

      await t.run(async (dbCtx) => {
        const rows = await dbCtx.db
          .query('yjsUpdates')
          .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
          .collect()

        expect(rows).toHaveLength(1)
        expect(rows[0].isSnapshot).toBe(true)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not trigger compaction before interval', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'No Compact Note',
      parentId: null,
    })

    for (let i = 1; i <= 19; i++) {
      await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
        documentId: noteId,
        update: makeEmptyYjsUpdate(),
      })
    }

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
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
        documentId: noteId,
        clientId: 1,
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
        documentId: noteId,
        clientId: 1,
        state: makeAwarenessState(),
      }),
    )
  })

  it('DM can push awareness state', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Awareness Note',
      parentId: null,
    })

    const state = makeAwarenessState()

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 42,
      state,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) =>
          q.eq('documentId', noteId).eq('clientId', 42),
        )
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].documentId).toBe(noteId)
      expect(rows[0].clientId).toBe(42)
      expect(rows[0].userId).toBe(ctx.dm.profile._id)
    })
  })

  it('upserts existing awareness entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Upsert Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 10,
      state: makeAwarenessState(),
    })

    const newState = new Uint8Array([5, 6, 7, 8]).buffer
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 10,
      state: newState,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) =>
          q.eq('documentId', noteId).eq('clientId', 10),
        )
        .collect()

      expect(rows).toHaveLength(1)
    })
  })

  it('creates separate entries for different clientIds', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Multi Client Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 1,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 2,
      state: makeAwarenessState(),
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()

      expect(rows).toHaveLength(2)
    })
  })

  it('player with view share can push awareness', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'View Share Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await playerAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 99,
      state: makeAwarenessState(),
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) =>
          q.eq('documentId', noteId).eq('clientId', 99),
        )
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].userId).toBe(ctx.player.profile._id)
    })
  })
})

describe('removeAwareness', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.yjsSync.mutations.removeAwareness, {
        documentId: noteId,
        clientId: 1,
      }),
    )
  })

  it('removes existing awareness entry', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Remove Awareness Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 5,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
      documentId: noteId,
      clientId: 5,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document_client', (q) =>
          q.eq('documentId', noteId).eq('clientId', 5),
        )
        .collect()

      expect(rows).toHaveLength(0)
    })
  })

  it('no-op when awareness entry does not exist', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'No-op Note',
      parentId: null,
    })

    const result = await dmAuth.mutation(
      api.yjsSync.mutations.removeAwareness,
      {
        documentId: noteId,
        clientId: 999,
      },
    )

    expect(result).toBeNull()
  })

  it('only removes matching clientId', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Selective Remove Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 1,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 2,
      state: makeAwarenessState(),
    })

    await dmAuth.mutation(api.yjsSync.mutations.removeAwareness, {
      documentId: noteId,
      clientId: 1,
    })

    await t.run(async (dbCtx) => {
      const rows = await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()

      expect(rows).toHaveLength(1)
      expect(rows[0].clientId).toBe(2)
    })
  })
})

describe('persistBlocks', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.notes.mutations.persistNoteBlocks, {
        documentId: noteId,
      }),
    )
  })

  it('requires write access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Write Access Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.notes.mutations.persistNoteBlocks, {
        documentId: noteId,
      }),
    )
  })

  it('works on empty document without crash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Empty Doc Note',
      parentId: null,
    })

    const result = await dmAuth.mutation(
      api.notes.mutations.persistNoteBlocks,
      {
        documentId: noteId,
      },
    )

    expect(result).toBeNull()
  })

  it('empty YDoc produces no blocks', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Persist Blocks Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    const result = await dmAuth.mutation(
      api.notes.mutations.persistNoteBlocks,
      {
        documentId: noteId,
      },
    )

    expect(result).toBeNull()

    await t.run(async (dbCtx) => {
      const blocks = await dbCtx.db
        .query('blocks')
        .filter((q) => q.eq(q.field('noteId'), noteId))
        .collect()

      expect(blocks.length).toBe(0)
    })
  })
})
