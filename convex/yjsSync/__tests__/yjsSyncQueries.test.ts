import { describe, expect, it } from 'vite-plus/test'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotAuthenticated, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate as makeEmptyYjsUpdate } from '../../_test/yjs.helper'

const firstPage = { cursor: null, numItems: 100 }

describe('getUpdates', () => {
  const t = createTestContext()
  // createNoteViaFilesystem seeds Yjs state; createNote does not.

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Auth Test Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expectNotAuthenticated(
      t.query(api.yjsSync.queries.getUpdates, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        afterSeq: null,
        paginationOpts: firstPage,
      }),
    )
  })

  it('requires read access', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      asPlayer(ctx).query(api.yjsSync.queries.getUpdates, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        afterSeq: null,
        paginationOpts: firstPage,
      }),
    )
  })

  it('returns updates ordered by seq ascending', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Ordered Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    const result = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page).toHaveLength(3)
    expect(result.page[0].seq).toBe(0)
    expect(result.page[1].seq).toBe(1)
    expect(result.page[2].seq).toBe(2)
    expect(result.isDone).toBe(true)
  })

  it('treats a null update cursor as the initial page', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Initial Cursor Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page.map((entry) => entry.seq)).toEqual([0])
    expect(result.isDone).toBe(true)
  })

  it('paginates updates without collecting every row', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Paged Updates Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    const firstResult = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: { cursor: null, numItems: 2 },
    })
    const secondResult = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: { cursor: firstResult.continueCursor, numItems: 2 },
    })

    expect(firstResult.page.map((entry) => entry.seq)).toEqual([0, 1])
    expect(firstResult.isDone).toBe(false)
    expect(secondResult.page.map((entry) => entry.seq)).toEqual([2])
    expect(secondResult.isDone).toBe(true)
  })

  it('returns the document revision with each update', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Fields Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page.length).toBeGreaterThan(0)
    for (const entry of result.page) {
      expect(Object.keys(entry).sort()).toEqual(['revision', 'seq', 'update'])
      expect(entry.revision).toBe(0)
    }
  })

  it('DM can read updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'DM Read Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page.length).toBeGreaterThan(0)
  })

  it('player with view share can read updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

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
      permissionLevel: 'view',
    })

    const result = await asPlayer(ctx).query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page.length).toBeGreaterThan(0)
  })

  it('returns empty array for note with no updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      afterSeq: null,
      paginationOpts: firstPage,
    })

    expect(result.page).toEqual([])
  })
})

describe('getAwareness', () => {
  const t = createTestContext()
  // createNoteViaFilesystem seeds Yjs state; createNote does not.

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Auth Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await expectNotAuthenticated(
      t.query(api.yjsSync.queries.getAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        paginationOpts: firstPage,
      }),
    )
  })

  it('requires read access', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      asPlayer(ctx).query(api.yjsSync.queries.getAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        paginationOpts: firstPage,
      }),
    )
  })

  it('returns empty array when no awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'No Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const result = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: firstPage,
    })

    expect(result.page).toEqual([])
  })

  it('returns awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const state = new ArrayBuffer(4)
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 42,
      sessionId: 'session-42',
      state,
    })

    const result = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: firstPage,
    })

    expect(result.page).toHaveLength(1)
    expect(result.page[0].clientId).toBe(42)
    expect(result.page[0].state).toBeInstanceOf(ArrayBuffer)
    expect(typeof result.page[0].updatedAt).toBe('number')
  })

  it('paginates awareness by client id without collecting every row', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Paged Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    for (const clientId of [30, 10, 20]) {
      await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
        campaignId: ctx.campaignDomainId,
        documentId: noteId,
        clientId,
        sessionId: `session-${clientId}`,
        state: new ArrayBuffer(4),
      })
    }

    const firstResult = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: { cursor: null, numItems: 2 },
    })
    const secondResult = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: { cursor: firstResult.continueCursor, numItems: 2 },
    })

    expect(firstResult.page.map((entry) => entry.clientId)).toEqual([10, 20])
    expect(firstResult.isDone).toBe(false)
    expect(secondResult.page.map((entry) => entry.clientId)).toEqual([30])
    expect(secondResult.isDone).toBe(true)
  })

  it('DM can read awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'DM Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 10,
      sessionId: 'session-10',
      state: new ArrayBuffer(4),
    })

    const result = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: firstPage,
    })

    expect(result.page).toHaveLength(1)
    expect(result.page[0].clientId).toBe(10)
    expect(result.page[0].state).toBeInstanceOf(ArrayBuffer)
    expect(typeof result.page[0].updatedAt).toBe('number')
  })

  it('player with view share can read awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Shared Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 20,
      sessionId: 'session-20',
      state: new ArrayBuffer(4),
    })

    const result = await asPlayer(ctx).query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: firstPage,
    })

    expect(result.page).toHaveLength(1)
    expect(result.page[0].clientId).toBe(20)
    expect(result.page[0].state).toBeInstanceOf(ArrayBuffer)
    expect(result.page[0].state.byteLength).toBe(4)
    expect(typeof result.page[0].updatedAt).toBe('number')
  })

  it('returns only clientId, state, and updatedAt fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Fields Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    const state = new ArrayBuffer(4)
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 99,
      sessionId: 'session-99',
      state,
    })

    const result = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      paginationOpts: firstPage,
    })

    expect(result.page).toHaveLength(1)
    for (const entry of result.page) {
      expect(Object.keys(entry).sort()).toEqual(['clientId', 'state', 'updatedAt'])
    }
  })
})
