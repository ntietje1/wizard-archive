import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
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
    const { shareId } = await createSidebarShare(t, dmId, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })
    const { bookmarkId } = await createBookmark(t, ctx.player.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: ctx.player.memberId,
    })

    // Trash the folder
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })

    // Verify soft-deletes on dependents
    const afterTrash = await t.run(async (dbCtx) => {
      return {
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        share: await dbCtx.db.get('sidebarItemShares', shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      }
    })
    expect(afterTrash.folder!.location).toBe('trash')
    expect(afterTrash.folder!.deletionTime).not.toBeNull()
    expect(afterTrash.note!.location).toBe('trash')
    expect(afterTrash.note!.deletionTime).not.toBeNull()
    expect(afterTrash.share!.deletionTime).not.toBeNull()
    expect(afterTrash.bookmark!.deletionTime).not.toBeNull()

    // Player cannot see note
    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        id: noteId,
      }),
    )

    // Restore the folder
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'sidebar',
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
    expect(afterRestore.share!.deletionTime).toBeNull()
    expect(afterRestore.bookmark!.deletionTime).toBeNull()

    // Player can see note again
    const noteAfterRestore = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(noteAfterRestore.myPermissionLevel).toBe('view')

    // Trash again and permanently delete
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      itemId: folderId,
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
    await createSidebarShare(t, dmId, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'sidebar',
    })

    const note = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: noteId })
    expect(note.myPermissionLevel).toBe('edit')
  })

  it('purge cleans up blockShares that were soft-deleted during trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { noteId } = await createNote(t, ctx.campaignId, dmId)
    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, dmId, {
      blockId: 'b1',
      shareStatus: 'individually_shared',
    })
    const { blockShareId } = await createBlockShare(t, dmId, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: ctx.player.memberId,
    })

    // Trash note (soft-deletes dependents including blockShare)
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(afterTrash!.deletionTime).not.toBeNull()

    // Permanently delete
    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      itemId: noteId,
    })

    const afterPurge = await t.run(async (dbCtx) => dbCtx.db.get('blockShares', blockShareId))
    expect(afterPurge).toBeNull()
  })
})
