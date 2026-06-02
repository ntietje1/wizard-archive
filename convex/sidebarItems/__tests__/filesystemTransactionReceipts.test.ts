import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createNote } from '../../_test/factories.helper'

describe('filesystem transaction receipts', () => {
  const t = createTestContext()

  it('returns event receipts instead of bucket arrays and records copy as undoable', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'copy-scene-once',
        command: {
          type: 'copy',
          itemIds: [noteId],
          targetParentId: null,
        },
      },
    )

    expect(receipt.transactionId).toEqual(expect.any(String))
    expect(receipt.direction).toBe('forward')
    expect(receipt.undoable).toBe(true)
    expect(receipt.events).toContainEqual(
      expect.objectContaining({ type: 'copied', sourceItemId: noteId }),
    )
    expect(receipt.summary.kind).toBe('copied')

    const transaction = await t.run(
      async (dbCtx) => await dbCtx.db.get('filesystemTransactions', receipt.transactionId!),
    )
    expect(transaction?.events).toEqual(receipt.events)
    expect(transaction?.changes).toHaveLength(receipt.patches.length)
    expect(transaction?.requestFingerprint).toEqual(expect.any(String))
  })

  it('rejects reusing a client operation id for a different filesystem command', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
      campaignId: ctx.campaignId,
      clientOperationId: 'rename-scene-once',
      command: { type: 'rename', itemId: noteId, name: 'Scene Two' },
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        clientOperationId: 'rename-scene-once',
        command: { type: 'rename', itemId: noteId, name: 'Scene Three' },
      }),
    ).rejects.toThrow('Client operation id was already used for a different filesystem command')
  })

  it('returns the original transaction id for undo and redo receipts', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const forward = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'rename', itemId: noteId, name: 'Scene Two' },
      },
    )
    const undo = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: forward.transactionId!,
      },
    )
    const redo = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: forward.transactionId!,
      },
    )

    expect(undo.transactionId).toBe(forward.transactionId)
    expect(redo.transactionId).toBe(forward.transactionId)
    expect(undo.direction).toBe('undo')
    expect(redo.direction).toBe('redo')
  })

  it('records command deltas instead of whole-campaign snapshots', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Touched',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Untouched' })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'rename-one-item',
        command: { type: 'rename', itemId: noteId, name: 'Renamed' },
      },
    )

    expect(receipt.patches).toHaveLength(1)
    expect(receipt.patches[0]).toMatchObject({ type: 'updateSidebarItem', itemId: noteId })
    if (receipt.patches[0]?.type !== 'updateSidebarItem') {
      throw new Error('Expected update patch')
    }
    expect(Object.keys(receipt.patches[0].fields).sort()).toEqual([
      'name',
      'slug',
      'updatedBy',
      'updatedTime',
    ])
    expect(receipt.patches[0].fields).not.toHaveProperty('campaignId')
    expect(receipt.patches[0].fields).not.toHaveProperty('parentId')

    const retryReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'rename-one-item',
        command: { type: 'rename', itemId: noteId, name: 'Renamed' },
      },
    )
    expect(retryReceipt.patches).toEqual(receipt.patches)
  })

  it('records path-created folders in the same filesystem transaction', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'create-note-in-new-path',
        command: {
          type: 'create',
          itemType: 'note',
          name: 'Scene',
          parentTarget: {
            kind: 'path',
            baseParentId: null,
            pathSegments: ['Adventures', 'Act One'],
          },
        },
      },
    )

    expect(receipt.events).toEqual([expect.objectContaining({ type: 'created', slug: 'scene' })])
    expect(receipt.summary).toMatchObject({
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
    })
    expect(receipt.patches.filter((patch) => patch.type === 'upsertSidebarItem')).toHaveLength(3)

    const activeAfterCreate = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    const createdIds = activeAfterCreate.map((item) => item._id).sort()
    expect(activeAfterCreate.map((item) => item.name).sort()).toEqual([
      'Act One',
      'Adventures',
      'Scene',
    ])

    const undoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(undoReceipt.patches.every((patch) => patch.type === 'updateSidebarItem')).toBe(true)
    const activeAfterUndo = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(activeAfterUndo).toHaveLength(0)

    const hiddenAfterUndo = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('status', 'undoHidden').eq('parentId', null),
        )
        .collect()
    })
    expect(hiddenAfterUndo).toHaveLength(1)
    expect(hiddenAfterUndo[0]?.status).toBe('undoHidden')

    const redoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(redoReceipt.patches.filter((patch) => patch.type === 'upsertSidebarItem')).toHaveLength(
      3,
    )
    const activeAfterRedo = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(activeAfterRedo.map((item) => item._id).sort()).toEqual(createdIds)
    expect(activeAfterRedo.map((item) => item.name).sort()).toEqual([
      'Act One',
      'Adventures',
      'Scene',
    ])
  })
})
