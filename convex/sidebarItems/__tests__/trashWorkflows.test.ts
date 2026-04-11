import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('trash workflows', () => {
  const t = createTestContext()

  describe('trash and restore with name conflicts', () => {
    it('deduplicates name when restoring a note whose name is now taken', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const original = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'Meeting Notes',
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: original.noteId,
        location: 'trash',
      })

      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'Meeting Notes',
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: original.noteId,
        location: 'sidebar',
      })

      const restored = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', original.noteId))
      expect(restored).not.toBeNull()
      expect(restored!.location).toBe('sidebar')
      expect(restored!.name).not.toBe('Meeting Notes')
      expect(restored!.name).toContain('Meeting Notes')
      expect(restored!.deletionTime).toBeNull()
    })
  })

  describe('folder trash cascades', () => {
    it('trashing a folder cascades to children, shares, and bookmarks then restores all', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'FolderA',
      })

      const noteA = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'NoteA',
        parentId: folder.folderId,
      })
      const noteB = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'NoteB',
        parentId: folder.folderId,
      })

      const share = await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteA.noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })

      const bookmark = await createBookmark(t, ctx.player.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteA.noteId,
        campaignMemberId: ctx.player.memberId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folder.folderId,
        location: 'trash',
      })

      const [trashedFolder, trashedNoteA, trashedNoteB, trashedShare, trashedBookmark] =
        await t.run(async (dbCtx) =>
          Promise.all([
            dbCtx.db.get('sidebarItems', folder.folderId),
            dbCtx.db.get('sidebarItems', noteA.noteId),
            dbCtx.db.get('sidebarItems', noteB.noteId),
            dbCtx.db.get('sidebarItemShares', share.shareId),
            dbCtx.db.get('bookmarks', bookmark.bookmarkId),
          ]),
        )

      expect(trashedFolder!.location).toBe('trash')
      expect(trashedFolder!.deletionTime).not.toBeNull()
      expect(trashedNoteA!.location).toBe('trash')
      expect(trashedNoteA!.deletionTime).not.toBeNull()
      expect(trashedNoteB!.location).toBe('trash')
      expect(trashedNoteB!.deletionTime).not.toBeNull()
      expect(trashedShare!.deletionTime).not.toBeNull()
      expect(trashedBookmark!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folder.folderId,
        location: 'sidebar',
      })

      const [restoredFolder, restoredNoteA, restoredNoteB, restoredShare, restoredBookmark] =
        await t.run(async (dbCtx) =>
          Promise.all([
            dbCtx.db.get('sidebarItems', folder.folderId),
            dbCtx.db.get('sidebarItems', noteA.noteId),
            dbCtx.db.get('sidebarItems', noteB.noteId),
            dbCtx.db.get('sidebarItemShares', share.shareId),
            dbCtx.db.get('bookmarks', bookmark.bookmarkId),
          ]),
        )

      expect(restoredFolder!.location).toBe('sidebar')
      expect(restoredFolder!.deletionTime).toBeNull()
      expect(restoredNoteA!.location).toBe('sidebar')
      expect(restoredNoteA!.deletionTime).toBeNull()
      expect(restoredNoteA!.parentId).toBe(folder.folderId)
      expect(restoredNoteB!.location).toBe('sidebar')
      expect(restoredNoteB!.deletionTime).toBeNull()
      expect(restoredNoteB!.parentId).toBe(folder.folderId)
      expect(restoredShare!.deletionTime).toBeNull()
      expect(restoredBookmark!.deletionTime).toBeNull()
    })
  })

  describe('permanent delete cleanup', () => {
    it('hard-deletes folder, children, shares, bookmarks, blocks, and block shares', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ToDelete',
      })

      const note = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ChildNote',
        parentId: folder.folderId,
      })

      const share = await createSidebarShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })

      const bookmark = await createBookmark(t, ctx.player.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        campaignMemberId: ctx.player.memberId,
      })

      const block = await createBlock(t, note.noteId, ctx.campaignId, ctx.dm.profile._id)

      const blockShare = await createBlockShare(t, ctx.dm.profile._id, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockId: block.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folder.folderId,
        location: 'trash',
      })

      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folder.folderId,
      })

      const [
        deletedFolder,
        deletedNote,
        deletedShare,
        deletedBookmark,
        deletedBlock,
        deletedBlockShare,
      ] = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', note.noteId),
          dbCtx.db.get('sidebarItemShares', share.shareId),
          dbCtx.db.get('bookmarks', bookmark.bookmarkId),
          dbCtx.db.get('blocks', block.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )

      expect(deletedFolder).toBeNull()
      expect(deletedNote).toBeNull()
      expect(deletedShare).toBeNull()
      expect(deletedBookmark).toBeNull()
      expect(deletedBlock).toBeNull()
      expect(deletedBlockShare).toBeNull()
    })
  })

  describe('empty trash', () => {
    it('removes all trashed items from the campaign', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const note1 = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'TrashNote1',
      })
      const note2 = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'TrashNote2',
      })
      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'TrashFolder',
      })
      const childNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ChildInTrash',
        parentId: folder.folderId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: note1.noteId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: note2.noteId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folder.folderId,
        location: 'trash',
      })

      await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
        campaignId: ctx.campaignId,
      })

      const [gone1, gone2, goneFolder, goneChild] = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', note1.noteId),
          dbCtx.db.get('sidebarItems', note2.noteId),
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', childNote.noteId),
        ]),
      )

      expect(gone1).toBeNull()
      expect(gone2).toBeNull()
      expect(goneFolder).toBeNull()
      expect(goneChild).toBeNull()
    })
  })
})
