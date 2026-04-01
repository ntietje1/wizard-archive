import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('hard delete YJS cleanup', () => {
  const t = createTestContext()

  it('hard-deleting a note removes its yjsUpdates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Doomed Note',
      parentId: null,
    })

    const updatesBefore = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(updatesBefore).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const updatesAfter = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(updatesAfter).toHaveLength(0)
  })

  it('hard-deleting a note removes its yjsAwareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Awareness Note',
      parentId: null,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 42,
      state: new ArrayBuffer(4),
    })

    const awarenessBefore = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(awarenessBefore).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const awarenessAfter = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(awarenessAfter).toHaveLength(0)
  })

  it('hard-deleting a folder cascades YJS cleanup for contained notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
    )

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Nested Note',
      parentId: folderId,
    })

    const updatesBefore = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(updatesBefore).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const updatesAfter = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
    expect(updatesAfter).toHaveLength(0)
  })
})
