import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createNote } from '../../_test/factories.helper'

describe('filesystem transaction pruning', () => {
  const t = createTestContext()

  it('prunes old transactions after the undo history limit', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const firstReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'retention-0',
        command: { type: 'rename', itemId: noteId, name: 'Scene 0' },
      },
    )
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: firstReceipt.transactionId!,
    })

    for (let index = 1; index <= 50; index += 1) {
      await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        clientOperationId: `retention-${index}`,
        command: { type: 'rename', itemId: noteId, name: `Scene ${index}` },
      })
    }

    const [prunedForward, retainedTransactions] = await t.run(async (dbCtx) => {
      const forward = await dbCtx.db.get('filesystemTransactions', firstReceipt.transactionId!)
      const transactions = await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_campaign_actor', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('actorMemberId', ctx.dm.memberId),
        )
        .collect()
      return [forward, transactions] as const
    })

    expect(prunedForward).toBeNull()
    expect(retainedTransactions).toHaveLength(50)
  })

  it('hard-deletes undo-hidden created rows when their transaction is pruned', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })
    const copyReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'copy-pruned-hidden-row',
        command: { type: 'copy', itemIds: [noteId], targetParentId: null },
      },
    )
    const copiedEvent = copyReceipt.events.find((event) => event.type === 'copied')
    expect(copiedEvent).toBeDefined()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: copyReceipt.transactionId!,
    })
    await t.run(async (dbCtx) => {
      const copied = await dbCtx.db.get('sidebarItems', copiedEvent!.itemId)
      expect(copied?.status).toBe('undoHidden')
    })

    for (let index = 0; index < 50; index += 1) {
      await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        clientOperationId: `prune-hidden-${index}`,
        command: { type: 'rename', itemId: noteId, name: `Scene ${index}` },
      })
    }

    await t.run(async (dbCtx) => {
      expect(await dbCtx.db.get('filesystemTransactions', copyReceipt.transactionId!)).toBeNull()
      expect(await dbCtx.db.get('sidebarItems', copiedEvent!.itemId)).toBeNull()
    })
  })

  it('does not let non-undoable transactions evict undo history', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const undoableReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'undoable-retained',
        command: { type: 'rename', itemId: noteId, name: 'Scene Retained' },
      },
    )

    for (let index = 0; index < 50; index += 1) {
      await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        clientOperationId: `non-undoable-${index}`,
        command: { type: 'emptyTrash' },
      })
    }

    const [retainedUndoable, undoableTransactions] = await t.run(async (dbCtx) => {
      const retained = await dbCtx.db.get('filesystemTransactions', undoableReceipt.transactionId!)
      const transactions = await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_campaign_actor_undoable', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('actorMemberId', ctx.dm.memberId)
            .eq('undoable', true),
        )
        .collect()
      return [retained, transactions] as const
    })

    expect(retainedUndoable).not.toBeNull()
    expect(undoableTransactions.map((transaction) => transaction._id)).toContain(
      undoableReceipt.transactionId,
    )
  })

  it('prunes non-undoable transaction history separately from undo history', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    for (let index = 0; index < 52; index += 1) {
      await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        clientOperationId: `non-undoable-prune-${index}`,
        command: { type: 'emptyTrash' },
      })
    }

    const nonUndoableTransactions = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_campaign_actor_undoable', (q) =>
          q
            .eq('campaignId', ctx.campaignId)
            .eq('actorMemberId', ctx.dm.memberId)
            .eq('undoable', false),
        )
        .collect()
    })

    expect(nonUndoableTransactions).toHaveLength(50)
    expect(
      nonUndoableTransactions.map((transaction) => transaction.clientOperationId),
    ).not.toContain('non-undoable-prune-0')
  })
})
