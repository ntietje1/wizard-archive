import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createCanvasViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { executeMoveCommand, createFolder, getSidebarItemRowId } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

describe('hard delete YJS cleanup', () => {
  const t = createTestContext()

  async function queryYjsUpdates(noteRowId: Id<'sidebarItems'>) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteRowId))
        .collect()
    })
  }

  async function queryYjsAwareness(noteRowId: Id<'sidebarItems'>) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsAwareness')
        .withIndex('by_document', (q) => q.eq('documentId', noteRowId))
        .collect()
    })
  }

  it('hard-deleting a note removes its yjsUpdates', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Doomed Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    expect(await queryYjsUpdates(noteRowId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(noteRowId)).toHaveLength(0)
  })

  it('hard-deleting a note removes its yjsAwareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 42,
      leaseId: 'note-awareness-lease',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsAwareness(noteRowId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsAwareness(noteRowId)).toHaveLength(0)
  })

  it('hard-deleting a canvas removes its Yjs rows', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Doomed Canvas',
      parentTarget: { kind: 'direct', parentId: null },
    })
    const canvasRowId = await getSidebarItemRowId(t, canvasId)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: canvasId,
      clientId: 42,
      leaseId: 'canvas-awareness-lease',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsUpdates(canvasRowId)).toHaveLength(1)
    expect(await queryYjsAwareness(canvasRowId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [canvasId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(canvasRowId)).toHaveLength(0)
    expect(await queryYjsAwareness(canvasRowId)).toHaveLength(0)
  })

  it('hard-deleting a folder cascades YJS cleanup for contained notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignDomainId,
      name: 'Nested Note',
      parentTarget: { kind: 'direct', parentId: folderId },
    })
    const noteRowId = await getSidebarItemRowId(t, noteId)

    expect(await queryYjsUpdates(noteRowId)).toHaveLength(1)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignDomainId,
      documentId: noteId,
      clientId: 42,
      leaseId: 'nested-note-awareness-lease',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsAwareness(noteRowId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(noteRowId)).toHaveLength(0)
    expect(await queryYjsAwareness(noteRowId)).toHaveLength(0)
  })
})
