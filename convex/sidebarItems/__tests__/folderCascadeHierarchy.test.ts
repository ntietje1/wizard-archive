import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
  createCanvas,
  createFile,
  createFolder,
  createGameMap,
  createMapPin,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { makeYjsUpdate } from '../../yjsSync/__tests__/makeYjsUpdate.helper'
import { api } from '../../_generated/api'

describe('folder cascade hierarchy', () => {
  const t = createTestContext()

  describe('mixed-type folder', () => {
    it('trash cascades to all child types and their dependents, restore recovers all', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId } = await createFolder(t, ctx.campaignId, dmId, { name: 'Mixed' })

      const { noteId } = await createNote(t, ctx.campaignId, dmId, { parentId: folderId })
      const block = await createBlock(t, noteId, ctx.campaignId, dmId)
      const blockShare = await createBlockShare(t, dmId, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: block.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      const { canvasId } = await createCanvas(t, ctx.campaignId, dmId, { parentId: folderId })
      const canvasYjsId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: canvasId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId, { parentId: folderId })
      const pin = await createMapPin(t, mapId, dmId, { itemId: noteId })

      const { fileId } = await createFile(t, ctx.campaignId, dmId, { parentId: folderId })

      const share = await createSidebarShare(t, dmId, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })
      const bookmark = await createBookmark(t, ctx.player.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: canvasId,
        campaignMemberId: ctx.player.memberId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => ({
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        canvas: await dbCtx.db.get('sidebarItems', canvasId),
        map: await dbCtx.db.get('sidebarItems', mapId),
        file: await dbCtx.db.get('sidebarItems', fileId),
        block: await dbCtx.db.get('blocks', block.blockDbId),
        blockShare: await dbCtx.db.get('blockShares', blockShare.blockShareId),
        canvasYjs: await dbCtx.db.get('yjsUpdates', canvasYjsId),
        pin: await dbCtx.db.get('mapPins', pin.pinId),
        share: await dbCtx.db.get('sidebarItemShares', share.shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmark.bookmarkId),
      }))

      expect(afterTrash.folder!.location).toBe('trash')
      expect(afterTrash.folder!.deletionTime).not.toBeNull()
      expect(afterTrash.note!.location).toBe('trash')
      expect(afterTrash.note!.deletionTime).not.toBeNull()
      expect(afterTrash.canvas!.location).toBe('trash')
      expect(afterTrash.canvas!.deletionTime).not.toBeNull()
      expect(afterTrash.map!.location).toBe('trash')
      expect(afterTrash.map!.deletionTime).not.toBeNull()
      expect(afterTrash.file!.location).toBe('trash')
      expect(afterTrash.file!.deletionTime).not.toBeNull()
      expect(afterTrash.block!.deletionTime).not.toBeNull()
      expect(afterTrash.blockShare!.deletionTime).not.toBeNull()
      expect(afterTrash.canvasYjs).not.toBeNull()
      expect(afterTrash.pin!.deletionTime).not.toBeNull()
      expect(afterTrash.share!.deletionTime).not.toBeNull()
      expect(afterTrash.bookmark!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        location: 'sidebar',
      })

      const afterRestore = await t.run(async (dbCtx) => ({
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        canvas: await dbCtx.db.get('sidebarItems', canvasId),
        map: await dbCtx.db.get('sidebarItems', mapId),
        file: await dbCtx.db.get('sidebarItems', fileId),
        block: await dbCtx.db.get('blocks', block.blockDbId),
        blockShare: await dbCtx.db.get('blockShares', blockShare.blockShareId),
        canvasYjs: await dbCtx.db.get('yjsUpdates', canvasYjsId),
        pin: await dbCtx.db.get('mapPins', pin.pinId),
        share: await dbCtx.db.get('sidebarItemShares', share.shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmark.bookmarkId),
      }))

      expect(afterRestore.folder!.location).toBe('sidebar')
      expect(afterRestore.folder!.deletionTime).toBeNull()
      expect(afterRestore.note!.location).toBe('sidebar')
      expect(afterRestore.note!.deletionTime).toBeNull()
      expect(afterRestore.note!.parentId).toBe(folderId)
      expect(afterRestore.canvas!.location).toBe('sidebar')
      expect(afterRestore.canvas!.deletionTime).toBeNull()
      expect(afterRestore.map!.location).toBe('sidebar')
      expect(afterRestore.map!.deletionTime).toBeNull()
      expect(afterRestore.file!.location).toBe('sidebar')
      expect(afterRestore.file!.deletionTime).toBeNull()
      expect(afterRestore.block!.deletionTime).toBeNull()
      expect(afterRestore.blockShare!.deletionTime).toBeNull()
      expect(afterRestore.canvasYjs).not.toBeNull()
      expect(afterRestore.pin!.deletionTime).toBeNull()
      expect(afterRestore.share!.deletionTime).toBeNull()
      expect(afterRestore.bookmark!.deletionTime).toBeNull()
    })

    it('hard-delete cleans up all child types and their dependents', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId } = await createFolder(t, ctx.campaignId, dmId, { name: 'ToDelete' })

      const { noteId } = await createNote(t, ctx.campaignId, dmId, { parentId: folderId })
      const block = await createBlock(t, noteId, ctx.campaignId, dmId)
      const noteYjsId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: noteId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      const { canvasId } = await createCanvas(t, ctx.campaignId, dmId, { parentId: folderId })
      const canvasYjsId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: canvasId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId, { parentId: folderId })
      const pin = await createMapPin(t, mapId, dmId, { itemId: noteId })

      const { fileId } = await createFile(t, ctx.campaignId, dmId, { parentId: folderId })

      const blockShare = await createBlockShare(t, dmId, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: block.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })
      const share = await createSidebarShare(t, dmId, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })
      const bookmark = await createBookmark(t, ctx.player.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: canvasId,
        campaignMemberId: ctx.player.memberId,
      })

      const extIds = await t.run(async (dbCtx) => {
        const [noteExt, mapExt, fileExt, canvasExt, folderExt] = await Promise.all([
          dbCtx.db
            .query('notes')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', noteId))
            .unique(),
          dbCtx.db
            .query('gameMaps')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
            .unique(),
          dbCtx.db
            .query('files')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
            .unique(),
          dbCtx.db
            .query('canvases')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', canvasId))
            .unique(),
          dbCtx.db
            .query('folders')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
            .unique(),
        ])
        return {
          noteExtId: noteExt!._id,
          mapExtId: mapExt!._id,
          fileExtId: fileExt!._id,
          canvasExtId: canvasExt!._id,
          folderExtId: folderExt!._id,
        }
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
      })

      const afterDelete = await t.run(async (dbCtx) => ({
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        canvas: await dbCtx.db.get('sidebarItems', canvasId),
        map: await dbCtx.db.get('sidebarItems', mapId),
        file: await dbCtx.db.get('sidebarItems', fileId),
        block: await dbCtx.db.get('blocks', block.blockDbId),
        blockShare: await dbCtx.db.get('blockShares', blockShare.blockShareId),
        noteYjs: await dbCtx.db.get('yjsUpdates', noteYjsId),
        canvasYjs: await dbCtx.db.get('yjsUpdates', canvasYjsId),
        pin: await dbCtx.db.get('mapPins', pin.pinId),
        share: await dbCtx.db.get('sidebarItemShares', share.shareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmark.bookmarkId),
        noteExt: await dbCtx.db.get('notes', extIds.noteExtId),
        mapExt: await dbCtx.db.get('gameMaps', extIds.mapExtId),
        fileExt: await dbCtx.db.get('files', extIds.fileExtId),
        canvasExt: await dbCtx.db.get('canvases', extIds.canvasExtId),
        folderExt: await dbCtx.db.get('folders', extIds.folderExtId),
      }))

      expect(afterDelete.folder).toBeNull()
      expect(afterDelete.note).toBeNull()
      expect(afterDelete.canvas).toBeNull()
      expect(afterDelete.map).toBeNull()
      expect(afterDelete.file).toBeNull()
      expect(afterDelete.block).toBeNull()
      expect(afterDelete.blockShare).toBeNull()
      expect(afterDelete.noteYjs).toBeNull()
      expect(afterDelete.canvasYjs).toBeNull()
      expect(afterDelete.pin).toBeNull()
      expect(afterDelete.share).toBeNull()
      expect(afterDelete.bookmark).toBeNull()
      expect(afterDelete.noteExt).toBeNull()
      expect(afterDelete.mapExt).toBeNull()
      expect(afterDelete.fileExt).toBeNull()
      expect(afterDelete.canvasExt).toBeNull()
      expect(afterDelete.folderExt).toBeNull()
    })
  })

  describe('deep nested folder (3 levels)', () => {
    it('trash cascades through all levels, restore recovers all', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId: root } = await createFolder(t, ctx.campaignId, dmId, { name: 'Root' })
      const { folderId: child } = await createFolder(t, ctx.campaignId, dmId, {
        name: 'Child',
        parentId: root,
      })
      const { folderId: grandchild } = await createFolder(t, ctx.campaignId, dmId, {
        name: 'Grandchild',
        parentId: child,
      })
      const { noteId: leaf } = await createNote(t, ctx.campaignId, dmId, {
        name: 'DeepNote',
        parentId: grandchild,
      })
      const block = await createBlock(t, leaf, ctx.campaignId, dmId)

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: root,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => ({
        root: await dbCtx.db.get('sidebarItems', root),
        child: await dbCtx.db.get('sidebarItems', child),
        grandchild: await dbCtx.db.get('sidebarItems', grandchild),
        leaf: await dbCtx.db.get('sidebarItems', leaf),
        block: await dbCtx.db.get('blocks', block.blockDbId),
      }))

      expect(afterTrash.root!.location).toBe('trash')
      expect(afterTrash.root!.deletionTime).not.toBeNull()
      expect(afterTrash.child!.location).toBe('trash')
      expect(afterTrash.child!.deletionTime).not.toBeNull()
      expect(afterTrash.grandchild!.location).toBe('trash')
      expect(afterTrash.grandchild!.deletionTime).not.toBeNull()
      expect(afterTrash.leaf!.location).toBe('trash')
      expect(afterTrash.leaf!.deletionTime).not.toBeNull()
      expect(afterTrash.block!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: root,
        location: 'sidebar',
      })

      const afterRestore = await t.run(async (dbCtx) => ({
        root: await dbCtx.db.get('sidebarItems', root),
        child: await dbCtx.db.get('sidebarItems', child),
        grandchild: await dbCtx.db.get('sidebarItems', grandchild),
        leaf: await dbCtx.db.get('sidebarItems', leaf),
        block: await dbCtx.db.get('blocks', block.blockDbId),
      }))

      expect(afterRestore.root!.location).toBe('sidebar')
      expect(afterRestore.root!.deletionTime).toBeNull()
      expect(afterRestore.child!.location).toBe('sidebar')
      expect(afterRestore.child!.deletionTime).toBeNull()
      expect(afterRestore.child!.parentId).toBe(root)
      expect(afterRestore.grandchild!.location).toBe('sidebar')
      expect(afterRestore.grandchild!.deletionTime).toBeNull()
      expect(afterRestore.grandchild!.parentId).toBe(child)
      expect(afterRestore.leaf!.location).toBe('sidebar')
      expect(afterRestore.leaf!.deletionTime).toBeNull()
      expect(afterRestore.leaf!.parentId).toBe(grandchild)
      expect(afterRestore.block!.deletionTime).toBeNull()
    })

    it('hard-delete removes all levels and dependents', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId: root } = await createFolder(t, ctx.campaignId, dmId, { name: 'Root' })
      const { folderId: child } = await createFolder(t, ctx.campaignId, dmId, {
        name: 'Child',
        parentId: root,
      })
      const { folderId: grandchild } = await createFolder(t, ctx.campaignId, dmId, {
        name: 'Grandchild',
        parentId: child,
      })
      const { noteId: leafNote } = await createNote(t, ctx.campaignId, dmId, {
        parentId: grandchild,
      })
      const { mapId: leafMap } = await createGameMap(t, ctx.campaignId, dmId, {
        parentId: grandchild,
      })
      const block = await createBlock(t, leafNote, ctx.campaignId, dmId)
      const pin = await createMapPin(t, leafMap, dmId, { itemId: leafNote })

      const share = await createSidebarShare(t, dmId, {
        campaignId: ctx.campaignId,
        sidebarItemId: leafNote,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      })

      const extIds = await t.run(async (dbCtx) => {
        const [noteExt, mapExt, rootExt, childExt, grandchildExt] = await Promise.all([
          dbCtx.db
            .query('notes')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', leafNote))
            .unique(),
          dbCtx.db
            .query('gameMaps')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', leafMap))
            .unique(),
          dbCtx.db
            .query('folders')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', root))
            .unique(),
          dbCtx.db
            .query('folders')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', child))
            .unique(),
          dbCtx.db
            .query('folders')
            .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', grandchild))
            .unique(),
        ])
        return {
          noteExtId: noteExt!._id,
          mapExtId: mapExt!._id,
          rootExtId: rootExt!._id,
          childExtId: childExt!._id,
          grandchildExtId: grandchildExt!._id,
        }
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: root,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: root,
      })

      const afterDelete = await t.run(async (dbCtx) => ({
        root: await dbCtx.db.get('sidebarItems', root),
        child: await dbCtx.db.get('sidebarItems', child),
        grandchild: await dbCtx.db.get('sidebarItems', grandchild),
        leafNote: await dbCtx.db.get('sidebarItems', leafNote),
        leafMap: await dbCtx.db.get('sidebarItems', leafMap),
        block: await dbCtx.db.get('blocks', block.blockDbId),
        pin: await dbCtx.db.get('mapPins', pin.pinId),
        share: await dbCtx.db.get('sidebarItemShares', share.shareId),
        noteExt: await dbCtx.db.get('notes', extIds.noteExtId),
        mapExt: await dbCtx.db.get('gameMaps', extIds.mapExtId),
        rootExt: await dbCtx.db.get('folders', extIds.rootExtId),
        childExt: await dbCtx.db.get('folders', extIds.childExtId),
        grandchildExt: await dbCtx.db.get('folders', extIds.grandchildExtId),
      }))

      expect(afterDelete.root).toBeNull()
      expect(afterDelete.child).toBeNull()
      expect(afterDelete.grandchild).toBeNull()
      expect(afterDelete.leafNote).toBeNull()
      expect(afterDelete.leafMap).toBeNull()
      expect(afterDelete.block).toBeNull()
      expect(afterDelete.pin).toBeNull()
      expect(afterDelete.share).toBeNull()
      expect(afterDelete.noteExt).toBeNull()
      expect(afterDelete.mapExt).toBeNull()
      expect(afterDelete.rootExt).toBeNull()
      expect(afterDelete.childExt).toBeNull()
      expect(afterDelete.grandchildExt).toBeNull()
    })
  })
})
