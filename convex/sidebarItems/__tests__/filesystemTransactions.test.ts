import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import { createCampaignWithDm, createFolder, createNote } from '../../_test/factories.helper'
import { makeYjsUpdateWithBlocks } from '../../yjsSync/__tests__/makeYjsUpdate.helper'

describe('filesystem transactions', () => {
  const t = createTestContext()

  it('uses status for active and trash queries while keeping location as sidebar', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Active' })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Trashed',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const active = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    const trashed = await dmAuth.query(api.sidebarItems.queries.getTrashedSidebarItems, {
      campaignId: ctx.campaignId,
    })

    expect(active.map((item) => item.name)).toEqual(['Active'])
    expect(active[0]).toMatchObject({ status: 'active', location: 'sidebar' })
    expect(trashed.map((item) => item.name)).toEqual(['Trashed'])
    expect(trashed[0]).toMatchObject({ status: 'trashed', location: 'sidebar' })
  })

  it('rejects filesystem commands that reference another campaign item or parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const otherCampaign = await createCampaignWithDm(t, ctx.dm.profile)
    const { noteId: localNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Local',
    })
    const { folderId: otherFolderId } = await createFolder(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Folder' },
    )
    const { noteId: otherNoteId } = await createNote(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      { name: 'Other Note' },
    )
    const { noteId: otherTrashedNoteId } = await createNote(
      t,
      otherCampaign.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Other Trash',
        status: 'trashed',
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      },
    )

    const commands = [
      { type: 'rename' as const, itemId: otherNoteId, name: 'Renamed' },
      { type: 'move' as const, itemIds: [otherNoteId], targetParentId: null },
      { type: 'trash' as const, itemIds: [otherNoteId] },
      { type: 'copy' as const, itemIds: [otherNoteId], targetParentId: null },
      { type: 'restore' as const, itemIds: [otherTrashedNoteId], targetParentId: null },
      { type: 'deleteForever' as const, itemIds: [otherTrashedNoteId] },
      { type: 'move' as const, itemIds: [localNoteId], targetParentId: otherFolderId },
      { type: 'copy' as const, itemIds: [localNoteId], targetParentId: otherFolderId },
    ]

    for (const command of commands) {
      await expect(
        dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
          campaignId: ctx.campaignId,
          command,
        }),
      ).rejects.toThrow()
    }

    const otherItems = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: otherCampaign.campaignId,
    })
    expect(otherItems.map((item) => item.name).sort()).toEqual(['Other Folder', 'Other Note'])
  })

  it('keeps undo-hidden items out of direct queries and active parent targets', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: hiddenFolderId, slug: hiddenFolderSlug } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Hidden',
        status: 'undoHidden',
      },
    )
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Visible',
    })

    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: hiddenFolderId,
      }),
    ).rejects.toThrow('This item could not be found')
    await expect(
      dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
        campaignId: ctx.campaignId,
        slug: hiddenFolderSlug,
      }),
    ).resolves.toBeNull()

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'note',
          name: 'Child',
          parentTarget: { kind: 'direct', parentId: hiddenFolderId },
        },
      }),
    ).rejects.toThrow('Parent not found')
    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: { type: 'move', itemIds: [noteId], targetParentId: hiddenFolderId },
      }),
    ).rejects.toThrow('Parent not found')
  })

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

  it('undoes and redoes a copy transaction through server-held patches', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'copy-scene-undo-redo',
        command: {
          type: 'copy',
          itemIds: [noteId],
          targetParentId: null,
        },
      },
    )
    expect(receipt.transactionId).not.toBeNull()
    const afterCopy = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(afterCopy.map((item) => item.name).sort()).toEqual(['Scene', 'Scene 1'])

    const undoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(undoReceipt.direction).toBe('undo')
    const afterUndo = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(afterUndo.map((item) => item.name)).toEqual(['Scene'])

    const redoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
      {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(redoReceipt.direction).toBe('redo')
    const afterRedo = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(afterRedo.map((item) => item.name).sort()).toEqual(['Scene', 'Scene 1'])
    expect(afterRedo.map((item) => item._id).sort()).toEqual(
      afterCopy.map((item) => item._id).sort(),
    )
  })

  it('rejects stale redo when an undo-hidden created item name was reused', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'note',
          name: 'Draft',
          parentTarget: { kind: 'direct', parentId: null },
        },
      },
    )
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Draft' })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId: receipt.transactionId!,
      }),
    ).rejects.toThrow('Filesystem transaction can no longer be applied cleanly')

    const active = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(active.filter((item) => item.name === 'Draft')).toHaveLength(1)
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

  it('applies multiple undo and redo transactions deterministically from original ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId: firstId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'First',
    })
    const { noteId: secondId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Second',
    })

    const firstReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'rename', itemId: firstId, name: 'First Renamed' },
      },
    )
    const secondReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'rename', itemId: secondId, name: 'Second Renamed' },
      },
    )

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: secondReceipt.transactionId!,
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: firstReceipt.transactionId!,
    })
    let items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(items.map((item) => item.name).sort()).toEqual(['First', 'Second'])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: firstReceipt.transactionId!,
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: secondReceipt.transactionId!,
    })
    items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(items.map((item) => item.name).sort()).toEqual(['First Renamed', 'Second Renamed'])
  })

  it('undoes and redoes rename, move, trash, and restore through the same patch path', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Opening',
    })

    const renameReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'rename', itemId: noteId, name: 'Cold Open' },
      },
    )
    expect(renameReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: renameReceipt.transactionId!,
    })
    let note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.name).toBe('Opening')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: renameReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.name).toBe('Cold Open')

    const moveReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'move', itemIds: [noteId], targetParentId: folderId },
      },
    )
    expect(moveReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: moveReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.parentId).toBeNull()
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: moveReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.parentId).toBe(folderId)

    const trashReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'trash', itemIds: [noteId] },
      },
    )
    expect(trashReceipt.undoable).toBe(true)
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.status).toBe('trashed')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: trashReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.status).toBe('active')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: trashReceipt.transactionId!,
    })
    const restoreReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'restore', itemIds: [noteId], targetParentId: folderId },
      },
    )
    expect(restoreReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: restoreReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.status).toBe('trashed')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: restoreReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.status).toBe('active')
    expect(note?.parentId).toBe(folderId)
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

  it('undo preconditions ignore unrelated fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original',
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'rename', itemId: noteId, name: 'Renamed' },
      },
    )

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', noteId, { previewLockedUntil: Date.now() + 1000 })
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteId))
    expect(note?.name).toBe('Original')
    expect(note?.previewLockedUntil).toEqual(expect.any(Number))
  })

  it('rejects undoing a created item after the created row changes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const createReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: {
          type: 'create',
          itemType: 'note',
          name: 'Draft',
          parentTarget: { kind: 'direct', parentId: null },
        },
      },
    )
    const created = createReceipt.events.find((event) => event.type === 'created')
    expect(created).toBeDefined()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
      campaignId: ctx.campaignId,
      command: { type: 'rename', itemId: created!.itemId, name: 'Draft Revised' },
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
        campaignId: ctx.campaignId,
        transactionId: createReceipt.transactionId!,
      }),
    ).rejects.toThrow('Filesystem transaction can no longer be applied cleanly')

    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', created!.itemId))
    expect(note).toMatchObject({ name: 'Draft Revised', status: 'active' })
  })

  it('resyncs relative note links after transaction undo and redo moves', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id
    const { folderId: folderA } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Folder A',
    })
    const { folderId: folderB } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Folder B',
    })
    const { noteId: targetId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Target',
      parentId: folderA,
    })
    const { noteId: sourceId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Source',
      parentId: folderA,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
      update: makeYjsUpdateWithBlocks([
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '[[./Target]]', styles: {} }],
          children: [],
        },
      ]),
    })
    await dmAuth.action(api.notes.actions.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
    })

    const moveReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'move', itemIds: [sourceId], targetParentId: folderB },
      },
    )
    let links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links[0]?.targetItemId).toBeNull()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: moveReceipt.transactionId!,
    })
    links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links[0]?.targetItemId).toBe(targetId)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: moveReceipt.transactionId!,
    })
    links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links[0]?.targetItemId).toBeNull()
  })

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

  it('undoes and redoes a replace conflict without a second planning pass', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Destination',
    })
    const { noteId: sourceId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })
    const { noteId: destinationId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      parentId: folderId,
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        command: { type: 'copy', itemIds: [sourceId], targetParentId: folderId },
        decisions: [{ sourceItemId: sourceId, action: 'replace' }],
      },
    )

    expect(receipt.undoable).toBe(true)
    expect(receipt.events).toContainEqual(
      expect.objectContaining({ type: 'replaced', sourceItemId: sourceId }),
    )
    let items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(
      items.filter((item) => item.name === 'Scene' && item.parentId === folderId),
    ).toHaveLength(1)
    expect(items.find((item) => item._id === destinationId)?.status).toBeUndefined()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(items.find((item) => item._id === destinationId)?.status).toBe('active')
    expect(
      items.filter((item) => item.name === 'Scene' && item.parentId === folderId),
    ).toHaveLength(1)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignId,
      transactionId: receipt.transactionId!,
    })
    items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(items.find((item) => item._id === destinationId)).toBeUndefined()
    expect(
      items.filter((item) => item.name === 'Scene' && item.parentId === folderId),
    ).toHaveLength(1)
  })

  it('does not record delete forever as undoable', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Archive',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const receipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'delete-folder-forever',
        command: {
          type: 'deleteForever',
          itemIds: [folderId],
        },
      },
    )

    expect(receipt.transactionId).toEqual(expect.any(String))
    expect(receipt.undoable).toBe(false)
    expect(receipt.events).toContainEqual(
      expect.objectContaining({ type: 'deletedForever', itemId: folderId }),
    )

    const retryReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.executeFileSystemCommand,
      {
        campaignId: ctx.campaignId,
        clientOperationId: 'delete-folder-forever',
        command: {
          type: 'deleteForever',
          itemIds: [folderId],
        },
      },
    )
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
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.executeFileSystemCommand, {
        campaignId: ctx.campaignId,
        command: { type: 'emptyTrash' },
      }),
    ).rejects.toThrow('Empty Trash can delete at most 100 items at once')
    const remainingTrash = await dmAuth.query(api.sidebarItems.queries.getTrashedSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(remainingTrash).toHaveLength(101)
  })
})
