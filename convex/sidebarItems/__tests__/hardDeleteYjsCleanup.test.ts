import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  createCanvasViaFilesystem,
  createNoteViaFilesystem,
} from '../../_test/filesystemSetup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { executeMoveCommand, createFolder } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

describe('hard delete YJS cleanup', () => {
  const t = createTestContext()

  async function queryYjsUpdates(noteId: Id<'sidebarItems'>) {
    return await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('yjsUpdates')
        .withIndex('by_document_seq', (q) => q.eq('documentId', noteId))
        .collect()
    })
  }

  async function queryYjsAwareness(noteId: Id<'sidebarItems'>) {
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

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Doomed Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(0)
  })

  it('hard-deleting a note removes its yjsAwareness entries', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Awareness Note',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      clientId: 42,
      sessionId: 'note-session',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsAwareness(noteId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsAwareness(noteId)).toHaveLength(0)
  })

  it('hard-deleting a canvas removes its Yjs rows', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { canvasId } = await createCanvasViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Doomed Canvas',
      parentTarget: { kind: 'direct', parentId: null },
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignId,
      documentId: canvasId,
      clientId: 42,
      sessionId: 'canvas-session',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsUpdates(canvasId)).toHaveLength(1)
    expect(await queryYjsAwareness(canvasId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [canvasId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(canvasId)).toHaveLength(0)
    expect(await queryYjsAwareness(canvasId)).toHaveLength(0)
  })

  it('hard-deleting a folder cascades YJS cleanup for contained notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const { noteId } = await createNoteViaFilesystem(dmAuth, {
      campaignId: ctx.campaignId,
      name: 'Nested Note',
      parentTarget: { kind: 'direct', parentId: folderId },
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(1)

    await dmAuth.mutation(api.yjsSync.mutations.pushAwareness, {
      campaignId: ctx.campaignId,
      documentId: noteId,
      clientId: 42,
      sessionId: 'nested-note-session',
      state: new ArrayBuffer(4),
    })

    expect(await queryYjsAwareness(noteId)).toHaveLength(1)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'emptyTrash' },
    })

    expect(await queryYjsUpdates(noteId)).toHaveLength(0)
    expect(await queryYjsAwareness(noteId)).toHaveLength(0)
  })
})
