import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
} from '../../_test/identities.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdate as makeEmptyYjsUpdate } from './makeYjsUpdate.helper'

describe('getUpdates', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Auth Test Note',
      parentId: null,
    })

    await expectNotAuthenticated(
      t.query(api.yjsSync.queries.getUpdates, { documentId: noteId }),
    )
  })

  it('requires read access', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      asPlayer(ctx).query(api.yjsSync.queries.getUpdates, {
        documentId: noteId,
      }),
    )
  })

  it('returns updates ordered by seq ascending', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Ordered Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })
    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      documentId: noteId,
      update: makeEmptyYjsUpdate(),
    })

    const results = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      documentId: noteId,
    })

    expect(results).toHaveLength(3)
    expect(results[0].seq).toBe(0)
    expect(results[1].seq).toBe(1)
    expect(results[2].seq).toBe(2)
  })

  it('returns only seq and update fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Fields Note',
      parentId: null,
    })

    const results = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      documentId: noteId,
    })

    expect(results.length).toBeGreaterThan(0)
    for (const entry of results) {
      expect(Object.keys(entry).sort()).toEqual(['seq', 'update'])
    }
  })

  it('DM can read updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'DM Read Note',
      parentId: null,
    })

    const results = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      documentId: noteId,
    })

    expect(results.length).toBeGreaterThan(0)
  })

  it('player with view share can read updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

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
      permissionLevel: 'view',
    })

    const results = await asPlayer(ctx).query(api.yjsSync.queries.getUpdates, {
      documentId: noteId,
    })

    expect(results.length).toBeGreaterThan(0)
  })

  it('returns empty array for note with no updates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const results = await dmAuth.query(api.yjsSync.queries.getUpdates, {
      documentId: noteId,
    })

    expect(results).toEqual([])
  })
})

describe('getAwareness', () => {
  const t = createTestContext()

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Auth Awareness Note',
      parentId: null,
    })

    await expectNotAuthenticated(
      t.query(api.yjsSync.queries.getAwareness, { documentId: noteId }),
    )
  })

  it('requires read access', async () => {
    const ctx = await setupCampaignContext(t)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      asPlayer(ctx).query(api.yjsSync.queries.getAwareness, {
        documentId: noteId,
      }),
    )
  })

  it('returns empty array when no awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'No Awareness Note',
      parentId: null,
    })

    const results = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      documentId: noteId,
    })

    expect(results).toEqual([])
  })

  it('returns awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Awareness Note',
      parentId: null,
    })

    const state = new ArrayBuffer(4)
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 42,
      state,
    })

    const results = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      documentId: noteId,
    })

    expect(results).toHaveLength(1)
    expect(results[0].clientId).toBe(42)
    expect(results[0].state).toBeInstanceOf(ArrayBuffer)
    expect(typeof results[0].updatedAt).toBe('number')
  })

  it('DM can read awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'DM Awareness Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 10,
      state: new ArrayBuffer(4),
    })

    const results = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      documentId: noteId,
    })

    expect(results).toHaveLength(1)
  })

  it('player with view share can read awareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Shared Awareness Note',
      parentId: null,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 20,
      state: new ArrayBuffer(4),
    })

    const results = await asPlayer(ctx).query(
      api.yjsSync.queries.getAwareness,
      { documentId: noteId },
    )

    expect(results).toHaveLength(1)
  })

  it('returns only clientId, state, and updatedAt fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Fields Awareness Note',
      parentId: null,
    })

    const state = new ArrayBuffer(4)
    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 99,
      state,
    })

    const results = await dmAuth.query(api.yjsSync.queries.getAwareness, {
      documentId: noteId,
    })

    expect(results).toHaveLength(1)
    for (const entry of results) {
      expect(Object.keys(entry).sort()).toEqual([
        'clientId',
        'state',
        'updatedAt',
      ])
    }
  })
})
