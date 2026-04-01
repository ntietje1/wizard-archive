import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { api } from '../../_generated/api'

describe('createNote YJS integration', () => {
  const t = createTestContext()

  it('creates a yjsUpdates row when creating a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Test Note',
      parentId: null,
    })

    const updates = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })

    expect(updates).toHaveLength(1)
    expect(updates[0].seq).toBe(0)
    expect(updates[0].isSnapshot).toBe(true)
  })

  it('creates valid YJS document for note without content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Empty Note',
      parentId: null,
    })

    const updates = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })

    expect(updates).toHaveLength(1)

    const doc = new Y.Doc()
    Y.applyUpdate(doc, new Uint8Array(updates[0].update))

    const fragment = doc.getXmlFragment('document')
    expect(fragment).toBeDefined()

    doc.destroy()
  })
})
