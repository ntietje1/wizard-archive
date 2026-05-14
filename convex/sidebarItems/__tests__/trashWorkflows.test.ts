import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  executeDeleteForeverCommand,
  executeEmptyTrashCommand,
  filesystemEventItemIds,
  createBlock,
  createBlockShare,
  createBookmark,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { expectValidationFailed } from '../../_test/assertions.helper'

describe('trash workflows', () => {
  const t = createTestContext()

  describe('trash and restore with name conflicts', () => {
    it('requires a conflict decision when restoring a note whose name is now taken', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const original = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'Meeting Notes',
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [original.noteId],
        targetParentId: null,
        action: 'trash',
      })

      await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'Meeting Notes',
      })

      await expectValidationFailed(
        executeMoveCommand(dmAuth, {
          campaignId: ctx.campaignId,
          sourceItemIds: [original.noteId],
          targetParentId: null,
          action: 'restore',
        }),
      )

      const stillTrashed = await t.run(async (dbCtx) =>
        dbCtx.db.get('sidebarItems', original.noteId),
      )
      expect(stillTrashed?.status).toBe('trashed')

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [original.noteId],
        targetParentId: null,
        action: 'restore',
        decisions: [{ sourceItemId: original.noteId, action: 'keepBoth' }],
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
    it('trashing a folder cascades to children then restores all; shares and bookmarks are preserved throughout', async () => {
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

      const share = await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteA.noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })

      const bookmark = await createBookmark(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteA.noteId,
        campaignMemberId: ctx.player.memberId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'trash',
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

      expect(trashedFolder!.status).toBe('trashed')
      expect(trashedFolder!.deletionTime).not.toBeNull()
      expect(trashedNoteA!.status).toBe('trashed')
      expect(trashedNoteA!.deletionTime).not.toBeNull()
      expect(trashedNoteB!.status).toBe('trashed')
      expect(trashedNoteB!.deletionTime).not.toBeNull()
      // Shares and bookmarks have no deletionTime — they are preserved unchanged when parent is trashed
      expect(trashedShare).not.toBeNull()
      expect(trashedShare!.sidebarItemId).toBe(noteA.noteId)
      expect(trashedBookmark).not.toBeNull()
      expect(trashedBookmark!.sidebarItemId).toBe(noteA.noteId)

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'restore',
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
      // Shares and bookmarks were never touched, still present after restore
      expect(restoredShare).not.toBeNull()
      expect(restoredShare!.sidebarItemId).toBe(noteA.noteId)
      expect(restoredShare!.campaignMemberId).toBe(ctx.player.memberId)
      expect(restoredBookmark).not.toBeNull()
      expect(restoredBookmark!.sidebarItemId).toBe(noteA.noteId)
      expect(restoredBookmark!.campaignMemberId).toBe(ctx.player.memberId)
    })

    it('bulk restore ignores redundant nested descendants and preserves hierarchy', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'FolderA',
      })
      const childFolder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ChildFolder',
        parentId: folder.folderId,
      })
      const nestedNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'NestedNote',
        parentId: childFolder.folderId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'trash',
      })

      const movedIds = await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId, nestedNote.noteId],
        targetParentId: null,
        action: 'restore',
      })

      const [restoredFolder, restoredChildFolder, restoredNestedNote] = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', childFolder.folderId),
          dbCtx.db.get('sidebarItems', nestedNote.noteId),
        ]),
      )

      expect(filesystemEventItemIds(movedIds, 'restored')).toEqual([folder.folderId])
      expect(restoredFolder!.location).toBe('sidebar')
      expect(restoredFolder!.parentId).toBeNull()
      expect(restoredChildFolder!.location).toBe('sidebar')
      expect(restoredChildFolder!.parentId).toBe(folder.folderId)
      expect(restoredNestedNote!.location).toBe('sidebar')
      expect(restoredNestedNote!.parentId).toBe(childFolder.folderId)
    })

    it('restores a trashed folder when the trash surface target points at that folder', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'FolderA',
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'trash',
      })

      const movedIds = await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: folder.folderId,
        action: 'restore',
      })

      const restoredFolder = await t.run((dbCtx) => dbCtx.db.get('sidebarItems', folder.folderId))

      expect(filesystemEventItemIds(movedIds, 'restored')).toEqual([folder.folderId])
      expect(restoredFolder!.location).toBe('sidebar')
      expect(restoredFolder!.parentId).toBeNull()
    })

    it('restores a child from a trashed folder surface to the sidebar root', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'FolderA',
      })
      const nestedNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'NestedNote',
        parentId: folder.folderId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'trash',
      })

      const movedIds = await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [nestedNote.noteId],
        targetParentId: folder.folderId,
        action: 'restore',
      })

      const [trashedFolder, restoredNote] = await t.run((dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', nestedNote.noteId),
        ]),
      )

      expect(filesystemEventItemIds(movedIds, 'restored')).toEqual([nestedNote.noteId])
      expect(trashedFolder!.status).toBe('trashed')
      expect(restoredNote!.location).toBe('sidebar')
      expect(restoredNote!.parentId).toBeNull()
    })

    it('bulk trash uses the batch move path and ignores redundant nested descendants', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'FolderA',
      })
      const nestedNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'NestedNote',
        parentId: folder.folderId,
      })
      const siblingNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'SiblingNote',
      })

      const movedIds = await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId, nestedNote.noteId, siblingNote.noteId],
        targetParentId: null,
        action: 'trash',
      })

      const [trashedFolder, trashedNestedNote, trashedSiblingNote] = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', nestedNote.noteId),
          dbCtx.db.get('sidebarItems', siblingNote.noteId),
        ]),
      )

      expect(filesystemEventItemIds(movedIds, 'trashed')).toEqual([
        folder.folderId,
        siblingNote.noteId,
      ])
      expect(trashedFolder!.status).toBe('trashed')
      expect(trashedFolder!.parentId).toBeNull()
      expect(trashedNestedNote!.status).toBe('trashed')
      expect(trashedNestedNote!.parentId).toBe(folder.folderId)
      expect(trashedSiblingNote!.status).toBe('trashed')
      expect(trashedSiblingNote!.parentId).toBeNull()
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

      const share = await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })

      const bookmark = await createBookmark(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: note.noteId,
        campaignMemberId: ctx.player.memberId,
      })

      const block = await createBlock(t, note.noteId, ctx.campaignId)

      const blockShare = await createBlockShare(t, {
        campaignId: ctx.campaignId,
        noteId: note.noteId,
        blockId: block.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
        targetParentId: null,
        action: 'trash',
      })

      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId],
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

    it('bulk permanently deletes unrelated items and ignores redundant nested descendants', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const folder = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ToDelete',
      })
      const childNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'ChildNote',
        parentId: folder.folderId,
      })
      const siblingNote = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
        name: 'SiblingNote',
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId, siblingNote.noteId],
        targetParentId: null,
        action: 'trash',
      })

      const deletedIds = await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folder.folderId, childNote.noteId, siblingNote.noteId],
      })

      const [deletedFolder, deletedChildNote, deletedSiblingNote] = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', folder.folderId),
          dbCtx.db.get('sidebarItems', childNote.noteId),
          dbCtx.db.get('sidebarItems', siblingNote.noteId),
        ]),
      )

      expect(filesystemEventItemIds(deletedIds, 'deletedForever')).toEqual([
        folder.folderId,
        siblingNote.noteId,
      ])
      expect(deletedFolder).toBeNull()
      expect(deletedChildNote).toBeNull()
      expect(deletedSiblingNote).toBeNull()
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

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [note1.noteId, note2.noteId, folder.folderId],
        targetParentId: null,
        action: 'trash',
      })

      const receipt = await executeEmptyTrashCommand(dmAuth, {
        campaignId: ctx.campaignId,
      })
      expect(filesystemEventItemIds(receipt, 'deletedForever').sort()).toEqual(
        [note1.noteId, note2.noteId, folder.folderId].sort(),
      )

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
