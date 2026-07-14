import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createFolder, createNote } from '../../_test/factories.helper'
import { testOperationId } from '../../../shared/test/operation-id'

describe('non-undoable filesystem transactions', () => {
  const t = createTestContext()

  it('does not record delete forever as undoable', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Archive',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const operationId = testOperationId('delete-folder-forever')
    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      operationId,
      command: {
        type: 'deleteForever',
        itemIds: [folderId],
      },
    })

    expect(receipt.transactionId).toEqual(expect.any(String))
    expect(receipt.undoable).toBe(false)
    expect(receipt.events).toContainEqual(
      expect.objectContaining({ type: 'deletedForever', itemId: folderId }),
    )

    const retryReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      operationId,
      command: {
        type: 'deleteForever',
        itemIds: [folderId],
      },
    })
    expect(retryReceipt.patches).toEqual(receipt.patches)
  })

  it('rejects empty trash when the bounded transaction would silently leave rows behind', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    for (let index = 0; index < 101; index += 1) {
      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: `Trash ${index}`,
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    }

    await expect(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignId,
        command: { type: 'emptyTrash' },
      }),
    ).rejects.toThrow('Empty Trash can delete at most 100 items at once')
    const { trash: remainingTrash } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(remainingTrash).toHaveLength(101)
  })
})
