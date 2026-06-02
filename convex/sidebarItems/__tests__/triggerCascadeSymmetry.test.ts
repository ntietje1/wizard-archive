import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  executeDeleteForeverCommand,
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
import { makeYjsUpdate } from '../../_test/yjs.helper'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../../shared/sidebar-items/types'

describe('trigger cascade symmetry', () => {
  const t = createTestContext()

  it('trashes, restores, and permanently deletes multiple item types through batch mutations', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { noteId } = await createNote(t, ctx.campaignId, dmId)
    const { canvasId } = await createCanvas(t, ctx.campaignId, dmId)
    const { mapId } = await createGameMap(t, ctx.campaignId, dmId)
    const sourceItemIds = [noteId, canvasId, mapId]

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds,
      targetParentId: null,
      action: 'trash',
    })

    const afterTrash = await t.run(async (dbCtx) =>
      Promise.all(sourceItemIds.map((itemId) => dbCtx.db.get('sidebarItems', itemId))),
    )
    expect(afterTrash.map((item) => item?.status)).toEqual(['trashed', 'trashed', 'trashed'])

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds,
      targetParentId: null,
      action: 'restore',
    })

    const afterRestore = await t.run(async (dbCtx) =>
      Promise.all(sourceItemIds.map((itemId) => dbCtx.db.get('sidebarItems', itemId))),
    )
    expect(afterRestore.map((item) => item?.location)).toEqual(['sidebar', 'sidebar', 'sidebar'])
    expect(afterRestore.map((item) => item?.parentId)).toEqual([null, null, null])

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds,
      targetParentId: null,
      action: 'trash',
    })
    await executeDeleteForeverCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds,
    })

    const afterDelete = await t.run(async (dbCtx) =>
      Promise.all(sourceItemIds.map((itemId) => dbCtx.db.get('sidebarItems', itemId))),
    )
    expect(afterDelete).toEqual([null, null, null])
  })

  describe('note: blocks and blockShares are NOT touched on trash/restore', () => {
    it('blocks and blockShares remain untouched through trash and restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { noteId } = await createNote(t, ctx.campaignId, dmId)
      const block1 = await createBlock(t, noteId, ctx.campaignId)
      const block2 = await createBlock(t, noteId, ctx.campaignId)
      const blockShare = await createBlockShare(t, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: block1.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      const beforeTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('blocks', block1.blockDbId),
          dbCtx.db.get('blocks', block2.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('blocks', block1.blockDbId),
          dbCtx.db.get('blocks', block2.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )
      expect(afterTrash[0]).toEqual(beforeTrash[0])
      expect(afterTrash[1]).toEqual(beforeTrash[1])
      expect(afterTrash[2]).toEqual(beforeTrash[2])

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('blocks', block1.blockDbId),
          dbCtx.db.get('blocks', block2.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )
      expect(afterRestore[0]).toEqual(beforeTrash[0])
      expect(afterRestore[1]).toEqual(beforeTrash[1])
      expect(afterRestore[2]).toEqual(beforeTrash[2])
    })

    it('hard-deletes blocks, blockShares, and Yjs document', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { noteId } = await createNote(t, ctx.campaignId, dmId)
      const block = await createBlock(t, noteId, ctx.campaignId)
      const blockShare = await createBlockShare(t, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: block.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      const yjsUpdateId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: noteId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
        targetParentId: null,
        action: 'trash',
      })
      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', noteId),
          dbCtx.db.get('blocks', block.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
          dbCtx.db.get('yjsUpdates', yjsUpdateId),
        ]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
      expect(afterDelete[2]).toBeNull()
      expect(afterDelete[3]).toBeNull()
    })
  })

  describe('canvas: Yjs document round-trip', () => {
    it('preserves Yjs document through trash and restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { canvasId } = await createCanvas(t, ctx.campaignId, dmId)

      const yjsUpdateId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: canvasId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [canvasId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('yjsUpdates', yjsUpdateId))
      expect(afterTrash).not.toBeNull()

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [canvasId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) => dbCtx.db.get('yjsUpdates', yjsUpdateId))
      expect(afterRestore).not.toBeNull()
    })

    it('deletes Yjs document only on hard-delete', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { canvasId } = await createCanvas(t, ctx.campaignId, dmId)

      const yjsUpdateId = await t.run(async (dbCtx) =>
        dbCtx.db.insert('yjsUpdates', {
          documentId: canvasId,
          update: makeYjsUpdate(),
          seq: 0,
          isSnapshot: false,
        }),
      )

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [canvasId],
        targetParentId: null,
        action: 'trash',
      })
      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [canvasId],
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', canvasId),
          dbCtx.db.get('yjsUpdates', yjsUpdateId),
        ]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
    })
  })

  describe('gameMap: pins are NOT touched on trash/restore', () => {
    it('pins remain untouched through trash and restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId)
      const { noteId: pinnedNote } = await createNote(t, ctx.campaignId, dmId)
      const pin1 = await createMapPin(t, mapId, { itemId: pinnedNote })
      const pin2 = await createMapPin(t, mapId, { itemId: pinnedNote })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [mapId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([dbCtx.db.get('mapPins', pin1.pinId), dbCtx.db.get('mapPins', pin2.pinId)]),
      )
      expect(afterTrash[0]).not.toBeNull()
      expect(afterTrash[1]).not.toBeNull()

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [mapId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([dbCtx.db.get('mapPins', pin1.pinId), dbCtx.db.get('mapPins', pin2.pinId)]),
      )
      expect(afterRestore[0]).not.toBeNull()
      expect(afterRestore[1]).not.toBeNull()
    })

    it('hard-deletes pins and extension on permanent delete', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId)
      const { noteId: pinnedNote } = await createNote(t, ctx.campaignId, dmId)
      const pin = await createMapPin(t, mapId, { itemId: pinnedNote })

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .unique()
        return ext!._id
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [mapId],
        targetParentId: null,
        action: 'trash',
      })
      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [mapId],
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', mapId),
          dbCtx.db.get('mapPins', pin.pinId),
          dbCtx.db.get('gameMaps', extId),
        ]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
      expect(afterDelete[2]).toBeNull()
    })
  })

  describe('file: extension round-trip', () => {
    it('preserves extension through trash and restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { fileId } = await createFile(t, ctx.campaignId, dmId)

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('files')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
          .unique()
        return ext!._id
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [fileId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('files', extId))
      expect(afterTrash).not.toBeNull()

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [fileId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) => dbCtx.db.get('files', extId))
      expect(afterRestore).not.toBeNull()
    })

    it('hard-deletes extension on permanent delete', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { fileId } = await createFile(t, ctx.campaignId, dmId)

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('files')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
          .unique()
        return ext!._id
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [fileId],
        targetParentId: null,
        action: 'trash',
      })
      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [fileId],
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([dbCtx.db.get('sidebarItems', fileId), dbCtx.db.get('files', extId)]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
    })
  })

  describe('folder: extension round-trip', () => {
    it('preserves extension through trash and restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
        inheritShares: true,
      })

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('folders')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
          .unique()
        return ext!._id
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('folders', extId))
      expect(afterTrash).not.toBeNull()
      expect(afterTrash!.inheritShares).toBe(true)

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) => dbCtx.db.get('folders', extId))
      expect(afterRestore).not.toBeNull()
      expect(afterRestore!.inheritShares).toBe(true)
    })

    it('hard-deletes extension on permanent delete', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { folderId } = await createFolder(t, ctx.campaignId, dmId)

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('folders')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderId))
          .unique()
        return ext!._id
      })

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

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([dbCtx.db.get('sidebarItems', folderId), dbCtx.db.get('folders', extId)]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
    })
  })

  describe('shares and bookmarks are NOT touched on trash, hard-deleted on purge', () => {
    type CampaignCtx = Awaited<ReturnType<typeof setupCampaignContext>>

    async function testShareBookmarkNotTouchedOnTrash(
      createItem: (ctx: CampaignCtx) => Promise<{ itemId: Id<'sidebarItems'> }>,
      itemType: SidebarItemType,
    ) {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { itemId } = await createItem(ctx)

      const { shareId } = await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId,
        sidebarItemType: itemType,
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'edit',
      })
      const { bookmarkId } = await createBookmark(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId,
        campaignMemberId: ctx.player.memberId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [itemId],
        targetParentId: null,
        action: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItemShares', shareId),
          dbCtx.db.get('bookmarks', bookmarkId),
        ]),
      )
      expect(afterTrash[0]).not.toBeNull()
      expect(afterTrash[1]).not.toBeNull()

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [itemId],
        targetParentId: null,
        action: 'restore',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItemShares', shareId),
          dbCtx.db.get('bookmarks', bookmarkId),
        ]),
      )
      expect(afterRestore[0]).not.toBeNull()
      expect(afterRestore[0]!.permissionLevel).toBe('edit')
      expect(afterRestore[1]).not.toBeNull()
      expect(afterRestore[1]!.sidebarItemId).toBe(itemId)
    }

    async function testShareBookmarkHardDelete(
      createItem: (ctx: CampaignCtx) => Promise<{ itemId: Id<'sidebarItems'> }>,
      itemType: SidebarItemType,
    ) {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)

      const { itemId } = await createItem(ctx)

      const { shareId } = await createSidebarShare(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId,
        sidebarItemType: itemType,
        campaignMemberId: ctx.player.memberId,
      })
      const { bookmarkId } = await createBookmark(t, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId,
        campaignMemberId: ctx.player.memberId,
      })

      await executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [itemId],
        targetParentId: null,
        action: 'trash',
      })
      await executeDeleteForeverCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [itemId],
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItems', itemId),
          dbCtx.db.get('sidebarItemShares', shareId),
          dbCtx.db.get('bookmarks', bookmarkId),
        ]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
      expect(afterDelete[2]).toBeNull()
    }

    it('note: shares and bookmarks untouched through trash round-trip', async () => {
      await testShareBookmarkNotTouchedOnTrash(async (ctx) => {
        const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: noteId }
      }, 'note')
    })

    it('canvas: shares and bookmarks untouched through trash round-trip', async () => {
      await testShareBookmarkNotTouchedOnTrash(async (ctx) => {
        const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: canvasId }
      }, 'canvas')
    })

    it('gameMap: shares and bookmarks untouched through trash round-trip', async () => {
      await testShareBookmarkNotTouchedOnTrash(async (ctx) => {
        const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: mapId }
      }, 'gameMap')
    })

    it('file: shares and bookmarks untouched through trash round-trip', async () => {
      await testShareBookmarkNotTouchedOnTrash(async (ctx) => {
        const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: fileId }
      }, 'file')
    })

    it('folder: shares and bookmarks untouched through trash round-trip', async () => {
      await testShareBookmarkNotTouchedOnTrash(async (ctx) => {
        const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: folderId }
      }, 'folder')
    })

    it('note: hard-delete removes shares and bookmarks', async () => {
      await testShareBookmarkHardDelete(async (ctx) => {
        const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: noteId }
      }, 'note')
    })

    it('canvas: hard-delete removes shares and bookmarks', async () => {
      await testShareBookmarkHardDelete(async (ctx) => {
        const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: canvasId }
      }, 'canvas')
    })

    it('gameMap: hard-delete removes shares and bookmarks', async () => {
      await testShareBookmarkHardDelete(async (ctx) => {
        const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: mapId }
      }, 'gameMap')
    })

    it('file: hard-delete removes shares and bookmarks', async () => {
      await testShareBookmarkHardDelete(async (ctx) => {
        const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: fileId }
      }, 'file')
    })

    it('folder: hard-delete removes shares and bookmarks', async () => {
      await testShareBookmarkHardDelete(async (ctx) => {
        const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
        return { itemId: folderId }
      }, 'folder')
    })
  })
})
