import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createTestContext } from '../../_test/setup.helper'
import { createNoteViaFilesystem } from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { getSidebarItemRowId } from '../../_test/factories.helper'

describe('createNote YJS integration', () => {
  const t = createTestContext()

  it('creates a yjsUpdates row when creating a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Test Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    const updates = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
        .collect()
    })

    expect(updates).toHaveLength(1)
    expect(updates[0].seq).toBe(0)
    expect(updates[0].isSnapshot).toBe(true)
  })

  it('creates valid YJS document for note without content', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Empty Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    const updates = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
        .collect()
    })

    expect(updates).toHaveLength(1)

    const doc = new Y.Doc()
    Y.applyUpdate(doc, new Uint8Array(updates[0].update))

    const fragment = doc.getXmlFragment('document')
    expect(fragment.length).toBe(0)

    doc.destroy()
  })
})
