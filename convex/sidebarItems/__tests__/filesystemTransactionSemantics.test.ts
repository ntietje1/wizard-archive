import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import type { ResourceColor } from '@wizard-archive/editor/resources/resource-contract'

const CONTENT_UPDATED_TIMESTAMP = 9_999_999_999

describe('filesystem transaction semantics', () => {
  const t = createTestContext()

  it('undoes a move after unrelated audit metadata changes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Destination',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'move', itemIds: [noteId], targetParentId: folderId },
    })
    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, {
        updatedTime: CONTENT_UPDATED_TIMESTAMP,
        updatedBy: ctx.dm.profile._id,
      })
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })

    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note).toMatchObject({
      parentId: null,
      updatedTime: CONTENT_UPDATED_TIMESTAMP,
    })
  })

  it('records metadata-only sidebar edits as real events and replays them symmetrically', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      color: '#14b8a6' as ResourceColor,
    })

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: {
        type: 'rename',
        itemId: noteId,
        color: '#ff0000' as ResourceColor,
      },
    })

    expect(receipt.summary.kind).toBe('updated')
    expect(receipt.events).toEqual([{ type: 'updated', itemId: noteId }])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    let note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.color).toBe('#14b8a6')

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.color).toBe('#ff0000')
  })
})
