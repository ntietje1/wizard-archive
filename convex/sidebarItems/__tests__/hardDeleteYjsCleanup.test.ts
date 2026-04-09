import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

describe('hard delete YJS cleanup', () => {
  const t = createTestContext()

  async function queryYjsUpdates(noteId: Id<'notes'>) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
  }

  async function queryYjsAwareness(noteId: Id<'notes'>) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteId))
        .collect()
    })
  }

  it('hard-deleting a note removes its yjsUpdates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Doomed Note',
      parentId: null,
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(0)
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

    expect(await queryYjsAwareness(noteId)).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    expect(await queryYjsAwareness(noteId)).toHaveLength(0)
  })

  it('hard-deleting a folder cascades YJS cleanup for contained notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Nested Note',
      parentId: folderId,
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(1)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      documentId: noteId,
      clientId: 42,
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsAwareness(noteId)).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(0)
    expect(await queryYjsAwareness(noteId)).toHaveLength(0)
  })
})
