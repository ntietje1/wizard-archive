import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  executeDeleteForeverCommand,
  createBlock,
  createBlockShare,
  createBookmark,
  createFolder,
  createNote,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('trash -> restore -> purge lifecycle with shares', () => {
  const t = createTestContext()

  it('full cycle: create with shares, trash, restore, trash again, permanently delete', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Shared Folder',
    })
    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Shared Note',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    const { bookmarkId } = await createBookmark(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: ctx.player.memberId,
    })

    // Trash the folder
    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    // Verify parent sidebarItems are trashed; shares and bookmarks are untouched (no cascade soft-delete)
    const afterTrash = await t.run(async (dbCtx) => {
      return {
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        share: await dbCtx.db.get('sidebarItemShares', shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      }
    })
    expect(afterTrash.folder!.status).toBe('trashed')
    expect(afterTrash.folder!.deletionTime).not.toBeNull()
    expect(afterTrash.note!.status).toBe('trashed')
    expect(afterTrash.note!.deletionTime).not.toBeNull()
    expect(afterTrash.share).not.toBeNull()
    expect(afterTrash.bookmark).not.toBeNull()

    // Restore the folder
    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'restore',
    })

    // Verify everything is restored
    const afterRestore = await t.run(async (dbCtx) => {
      return {
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        share: await dbCtx.db.get('sidebarItemShares', shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      }
    })
    expect(afterRestore.folder!.location).toBe('sidebar')
    expect(afterRestore.folder!.deletionTime).toBeNull()
    expect(afterRestore.note!.location).toBe('sidebar')
    expect(afterRestore.note!.deletionTime).toBeNull()
    // Shares and bookmarks were never touched, so they still exist after restore
    expect(afterRestore.share).not.toBeNull()
    expect(afterRestore.bookmark).not.toBeNull()

    // Player can see note again
    const noteAfterRestore = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(noteAfterRestore.myPermissionLevel).toBe('view')

    // Trash again and permanently delete
    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })
    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
    })

    // Verify all hard-deleted
    const afterPurge = await t.run(async (dbCtx) => {
      return {
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        share: await dbCtx.db.get('sidebarItemShares', shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      }
    })
    expect(afterPurge.folder).toBeNull()
    expect(afterPurge.note).toBeNull()
    expect(afterPurge.share).toBeNull()
    expect(afterPurge.bookmark).toBeNull()
  })

  it('restoring preserves share permission levels', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { noteId } = await createNote(t, ctx.campaignId, dmId)
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })
    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    const note = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(note.myPermissionLevel).toBe('edit')
  })

  it('trashes and restores multiple roots with nested descendants through the batch path', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Batch Folder',
    })
    const { noteId: childNoteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Nested Note',
    })
    const { noteId: siblingNoteId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Sibling Note',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId, siblingNoteId],
      targetParentId: null,
      action: 'trash',
    })

    const afterTrash = await t.run(async (dbCtx) =>
      Promise.all([
        dbCtx.db.get('sidebarItems', folderId),
        dbCtx.db.get('sidebarItems', childNoteId),
        dbCtx.db.get('sidebarItems', siblingNoteId),
      ]),
    )
    expect(afterTrash.map((item) => item?.status)).toEqual(['trashed', 'trashed', 'trashed'])

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId, siblingNoteId],
      targetParentId: null,
      action: 'restore',
    })

    const afterRestore = await t.run(async (dbCtx) =>
      Promise.all([
        dbCtx.db.get('sidebarItems', folderId),
        dbCtx.db.get('sidebarItems', childNoteId),
        dbCtx.db.get('sidebarItems', siblingNoteId),
      ]),
    )
    expect(afterRestore.map((item) => item?.location)).toEqual(['sidebar', 'sidebar', 'sidebar'])
    expect(afterRestore[0]?.parentId).toBeNull()
    expect(afterRestore[2]?.parentId).toBeNull()
  })

  it('purge hard-deletes blockShares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { noteId } = await createNote(t, ctx.campaignId, dmId)
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('b1'),
      shareStatus: 'individually_shared',
    })
    const { blockShareId } = await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(afterTrash).not.toBeNull()

    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
    })

    const afterPurge = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(afterPurge).toBeNull()
  })
})
