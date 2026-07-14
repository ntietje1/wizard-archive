import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createNote } from '../../_test/factories.helper'
import { createTestContext } from '../../_test/setup.helper'
import type { ResourceTransactionReceipt } from '@wizard-archive/editor/resources/transaction-contract'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'

async function executeToggleBookmarks(
  dmAuth: ReturnType<typeof asDm>,
  {
    campaignId,
    itemIds,
  }: {
    campaignId: CampaignId
    itemIds: Array<ResourceId>
  },
) {
  return await executeTestFileSystemCommand(dmAuth, {
    campaignId,
    command: { type: 'toggleBookmarks', itemIds },
  })
}

function transactionIdFrom(receipt: ResourceTransactionReceipt) {
  expect(receipt.transactionId).toEqual(expect.any(String))
  return receipt.transactionId!
}

describe('filesystem bookmark operations', () => {
  const t = createTestContext()

  it('records bookmark toggles as undoable filesystem transactions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const initialReceipt = await executeToggleBookmarks(dmAuth, {
      campaignId: ctx.campaignDomainId,
      itemIds: [noteId, noteId],
    })

    expect(initialReceipt.summary).toMatchObject({
      kind: 'bookmarksUpdated',
      affectedCount: 1,
    })
    expect(initialReceipt.patches).toMatchObject([
      { type: 'setResourceBookmarkState', itemId: noteId, isBookmarked: true },
    ])
    expect(initialReceipt.undoable).toBe(true)

    const transactionId = transactionIdFrom(initialReceipt)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId,
    })

    const afterUndoReceipt = await executeToggleBookmarks(dmAuth, {
      campaignId: ctx.campaignDomainId,
      itemIds: [noteId, noteId],
    })
    expect(afterUndoReceipt.patches).toMatchObject([
      { type: 'setResourceBookmarkState', itemId: noteId, isBookmarked: true },
    ])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: transactionIdFrom(afterUndoReceipt),
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId,
    })

    const afterRedoReceipt = await executeToggleBookmarks(dmAuth, {
      campaignId: ctx.campaignDomainId,
      itemIds: [noteId],
    })
    expect(afterRedoReceipt.patches).toMatchObject([
      { type: 'setResourceBookmarkState', itemId: noteId, isBookmarked: false },
    ])
  })
})
