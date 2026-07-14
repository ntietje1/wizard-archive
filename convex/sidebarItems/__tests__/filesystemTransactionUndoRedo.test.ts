import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { getPreviewLease } from '../previewLease'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createTestContext } from '../../_test/setup.helper'
import {
  createFolder,
  createNote,
  createSidebarShare,
  getSidebarItemRowId,
} from '../../_test/factories.helper'
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { getNoteLinksForSource, setupSiblingRelativeNoteLink } from '../../_test/noteLinks.helper'

describe('filesystem transaction undo and redo', () => {
  const t = createTestContext()

  it('undoes and redoes a copy transaction through server-held patches', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'copy',
        itemIds: [noteId],
        targetParentId: null,
      },
    })
    expect(receipt.transactionId).not.toBeNull()
    const { active: afterCopy } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(afterCopy.map((item) => item.name).sort()).toEqual(['Scene', 'Scene'])

    const undoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.undoFileSystemTransaction,
      {
        campaignId: ctx.campaignDomainId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(undoReceipt.direction).toBe('undo')
    const { active: afterUndo } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(afterUndo.map((item) => item.name)).toEqual(['Scene'])

    const redoReceipt = await dmAuth.mutation(
      api.sidebarItems.filesystem.mutations.redoFileSystemTransaction,
      {
        campaignId: ctx.campaignDomainId,
        transactionId: receipt.transactionId!,
      },
    )
    expect(redoReceipt.direction).toBe('redo')
    const { active: afterRedo } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(afterRedo.map((item) => item.name).sort()).toEqual(['Scene', 'Scene'])
    expect(afterRedo.map((item) => item.id).sort()).toEqual(afterCopy.map((item) => item.id).sort())
  })

  it('redoes a create when another item now has the same title', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'create',
        itemType: 'note',
        name: 'Draft',
        parentTarget: { kind: 'direct', parentId: null },
      },
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: receipt.transactionId!,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Draft' })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: receipt.transactionId!,
    })

    const { active } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(active.filter((item) => item.name === 'Draft')).toHaveLength(2)
  })

  it('rejects stale undo after the actor loses current item access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Player Scene',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const receipt = await executeTestFileSystemCommand(playerAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: noteId, name: 'Player Scene Renamed' },
    })

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'setResourcesMemberPermission',
        itemIds: [noteId],
        campaignMemberId: ctx.player.memberDomainId,
        permissionLevel: 'none',
      },
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
        campaignId: ctx.campaignDomainId,
        transactionId: receipt.transactionId!,
      }),
    )

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })
    expect(item.name).toBe('Player Scene Renamed')
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

    const firstReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: firstId, name: 'First Renamed' },
    })
    const secondReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: secondId, name: 'Second Renamed' },
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: secondReceipt.transactionId!,
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: firstReceipt.transactionId!,
    })
    let { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(items.map((item) => item.name).sort()).toEqual(['First', 'Second'])

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: firstReceipt.transactionId!,
    })
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: secondReceipt.transactionId!,
    })
    items = (
      await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
        campaignId: ctx.campaignDomainId,
      })
    ).active
    expect(items.map((item) => item.name).sort()).toEqual(['First Renamed', 'Second Renamed'])
  })

  it('undoes and redoes rename, move, trash, and restore through the same patch path', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Opening',
    })

    const renameReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: noteId, name: 'Cold Open' },
    })
    expect(renameReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: renameReceipt.transactionId!,
    })
    let note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.name).toBe('Opening')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: renameReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.name).toBe('Cold Open')

    const moveReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'move', itemIds: [noteId], targetParentId: folderId },
    })
    expect(moveReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: moveReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.parentId).toBeNull()
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: moveReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.parentId).toBe(folderRowId)

    const trashReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'trash', itemIds: [noteId] },
    })
    expect(trashReceipt.undoable).toBe(true)
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.status).toBe('trashed')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: trashReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.status).toBe('active')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: trashReceipt.transactionId!,
    })
    const restoreReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'restore', itemIds: [noteId], targetParentId: folderId },
    })
    expect(restoreReceipt.undoable).toBe(true)
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: restoreReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.status).toBe('trashed')
    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: restoreReceipt.transactionId!,
    })
    note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.status).toBe('active')
    expect(note?.parentId).toBe(folderRowId)
  })

  it('undo preconditions ignore unrelated fields', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original',
    })

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: noteId, name: 'Renamed' },
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.insert('sidebarItemPreviewLeases', {
        sidebarItemId: noteRowId,
        claimToken: 'claim',
        lockedUntil: Date.now() + 1000,
      })
    })

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: receipt.transactionId!,
    })
    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', noteRowId))
    expect(note?.name).toBe('Original')
    const lease = await t.run(async (dbCtx) => await getPreviewLease(dbCtx, noteRowId))
    expect(lease?.lockedUntil).toEqual(expect.any(Number))
  })

  it('rejects undoing a created item after the created row changes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const createReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: {
        type: 'create',
        itemType: 'note',
        name: 'Draft',
        parentTarget: { kind: 'direct', parentId: null },
      },
    })
    const created = createReceipt.events.find((event) => event.type === 'created')
    expect(created).toBeDefined()

    await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'rename', itemId: created!.itemId, name: 'Draft Revised' },
    })

    await expect(
      dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
        campaignId: ctx.campaignDomainId,
        transactionId: createReceipt.transactionId!,
      }),
    ).rejects.toThrow('Filesystem transaction can no longer be applied cleanly')

    const createdRowId = await getSidebarItemRowId(t, created!.itemId)
    const note = await t.run(async (dbCtx) => await dbCtx.db.get('sidebarItems', createdRowId))
    expect(note).toMatchObject({ name: 'Draft Revised', status: 'active' })
  })

  it('resyncs relative note links after transaction undo and redo moves', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderB, sourceId, targetId } = await setupSiblingRelativeNoteLink(t, dmAuth, {
      campaignId: ctx.campaignId,
      campaignDomainId: ctx.campaignDomainId,
      creatorProfileId: ctx.dm.profile._id,
    })

    const moveReceipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      command: { type: 'move', itemIds: [sourceId], targetParentId: folderB },
    })
    let links = await getNoteLinksForSource(t, ctx.campaignId, sourceId)
    expect(links[0]?.targetItemId).toBeNull()

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.undoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: moveReceipt.transactionId!,
    })
    links = await getNoteLinksForSource(t, ctx.campaignId, sourceId)
    expect(links[0]?.targetItemId).toBe(targetId)

    await dmAuth.mutation(api.sidebarItems.filesystem.mutations.redoFileSystemTransaction, {
      campaignId: ctx.campaignDomainId,
      transactionId: moveReceipt.transactionId!,
    })
    links = await getNoteLinksForSource(t, ctx.campaignId, sourceId)
    expect(links[0]?.targetItemId).toBeNull()
  })
})
