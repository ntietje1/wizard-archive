import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { testOperationId } from '../../../shared/test/operation-id'
import { isUuidV7 } from '@wizard-archive/editor/resources/domain-id'

describe('filesystem transaction receipts', () => {
  const t = createTestContext()

  it('returns event receipts instead of bucket arrays and records copy as undoable', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      operationId: testOperationId('copy-scene-once'),
      command: {
        type: 'copy',
        itemIds: [noteId],
        targetParentId: null,
      },
    })

    expect(isUuidV7(receipt.transactionId!)).toBe(true)
    expect(receipt.direction).toBe('forward')
    expect(receipt.undoable).toBe(true)
    expect(receipt.events).toContainEqual(
      expect.objectContaining({ type: 'copied', sourceItemId: noteId }),
    )
    expect(receipt.summary.kind).toBe('copied')

    const transaction = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_operationUuid', (query) => query.eq('operationUuid', receipt.transactionId!))
        .unique()
    })
    expect(transaction?.events).toEqual(receipt.events)
    expect(transaction?.changes).toHaveLength(receipt.patches.length)
    expect(transaction?.requestFingerprint).toEqual(expect.any(String))
    expect(transaction?.operationUuid).toBe(receipt.transactionId)
  })

  it('rejects non-UUIDv7 operation ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignDomainId,
        operationId: 'not-an-operation-id' as never,
        command: { type: 'rename', itemId: noteId, name: 'Scene Two' },
      }),
    ).rejects.toThrow('Expected a lowercase UUIDv7 operation id')
  })

  it('rejects reusing an operation id for a different filesystem command', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const operationId = testOperationId('rename-scene-once')
    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      operationId,
      command: { type: 'rename', itemId: noteId, name: 'Scene Two' },
    })

    await expect(
      executeTestFileSystemCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
        operationId,
        command: { type: 'rename', itemId: noteId, name: 'Scene Three' },
      }),
    ).rejects.toThrow('Operation id was already used for a different filesystem command')
  })

  it('allows edit permission to rename but not move the same item', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await executeTestFileSystemCommand(playerAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: noteId, name: 'Scene Revised' },
    })

    const renamed = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })
    expect(renamed.name).toBe('Scene Revised')

    await expectPermissionDenied(
      executeTestFileSystemCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        command: { type: 'move', itemIds: [noteId], targetParentId: null },
      }),
    )
  })

  it('returns the original transaction id for undo and redo receipts', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const forward = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: noteId, name: 'Scene Two' },
    })
    const undo = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignDomainId,
        transactionId: forward.transactionId!,
      },
    )
    const redo = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
      {
        campaignId: ctx.campaignDomainId,
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

    const operationId = testOperationId('rename-one-item')
    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      operationId,
      command: { type: 'rename', itemId: noteId, name: 'Renamed' },
    })

    expect(receipt.patches).toHaveLength(1)
    expect(receipt.patches[0]).toMatchObject({ type: 'updateResource', itemId: noteId })
    if (receipt.patches[0]?.type !== 'updateResource') {
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

    const retryReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      operationId,
      command: { type: 'rename', itemId: noteId, name: 'Renamed' },
    })
    expect(retryReceipt.patches).toEqual(receipt.patches)
  })

  it('records path-created folders in the same filesystem transaction', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      operationId: testOperationId('create-note-in-new-path'),
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
    })

    expect(receipt.events).toEqual([expect.objectContaining({ type: 'created', slug: 'scene' })])
    expect(receipt.summary).toMatchObject({
      kind: 'created',
      affectedCount: 1,
      createdCount: 1,
    })
    expect(receipt.patches.filter((patch) => patch.type === 'upsertResource')).toHaveLength(3)

    const { active: activeAfterCreate } = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItems,
      { campaignId: ctx.campaignDomainId },
    )
    const createdIds = activeAfterCreate.map((item) => item.id).sort()
    expect(activeAfterCreate.map((item) => item.name).sort()).toEqual([
      'Act One',
      'Adventures',
      'Scene',
    ])

    const undoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignDomainId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(undoReceipt.patches.every((patch) => patch.type === 'updateResource')).toBe(true)
    const { active: activeAfterUndo } = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItems,
      { campaignId: ctx.campaignDomainId },
    )
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
        campaignId: ctx.campaignDomainId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(redoReceipt.patches).toHaveLength(3)
    expect(redoReceipt.patches.every((patch) => patch.type === 'updateResource')).toBe(true)
    expect(redoReceipt.patches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'updateResource',
          fields: expect.objectContaining({ status: 'active' }),
        }),
      ]),
    )
    const { active: activeAfterRedo } = await dmAuth.query(
      api.sidebarItems.queries.getSidebarItems,
      { campaignId: ctx.campaignDomainId },
    )
    expect(activeAfterRedo.map((item) => item.id).sort()).toEqual(createdIds)
    expect(activeAfterRedo.map((item) => item.name).sort()).toEqual([
      'Act One',
      'Adventures',
      'Scene',
    ])
  })
})
