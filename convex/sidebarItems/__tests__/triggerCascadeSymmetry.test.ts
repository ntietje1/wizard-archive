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

describe('trigger cascade symmetry', () => {
  const t = createTestContext()

  describe('note: blocks and blockShares round-trip', () => {
    it('soft-deletes blocks and blockShares on trash, restores on restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { noteId } = await createNote(t, ctx.campaignId, dmId)
      const block1 = await createBlock(t, noteId, ctx.campaignId, dmId)
      const block2 = await createBlock(t, noteId, ctx.campaignId, dmId)
      const blockShare = await createBlockShare(t, dmId, {
        campaignId: ctx.campaignId,
        noteId,
        blockId: block1.blockDbId,
        campaignMemberId: ctx.player.memberId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: noteId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('blocks', block1.blockDbId),
          dbCtx.db.get('blocks', block2.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )
      expect(afterTrash[0]!.deletionTime).not.toBeNull()
      expect(afterTrash[1]!.deletionTime).not.toBeNull()
      expect(afterTrash[2]!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: noteId,
        location: 'sidebar',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('blocks', block1.blockDbId),
          dbCtx.db.get('blocks', block2.blockDbId),
          dbCtx.db.get('blockShares', blockShare.blockShareId),
        ]),
      )
      expect(afterRestore[0]!.deletionTime).toBeNull()
      expect(afterRestore[1]!.deletionTime).toBeNull()
      expect(afterRestore[2]!.deletionTime).toBeNull()
    })

    it('hard-deletes blocks, blockShares, and Yjs document', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { noteId } = await createNote(t, ctx.campaignId, dmId)
      const block = await createBlock(t, noteId, ctx.campaignId, dmId)
      const blockShare = await createBlockShare(t, dmId, {
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: noteId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: noteId,
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: canvasId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('yjsUpdates', yjsUpdateId))
      expect(afterTrash).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: canvasId,
        location: 'sidebar',
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: canvasId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: canvasId,
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

  describe('gameMap: pins round-trip', () => {
    it('soft-deletes pins on trash, restores on restore', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId)
      const { noteId: pinnedNote } = await createNote(t, ctx.campaignId, dmId)
      const pin1 = await createMapPin(t, mapId, dmId, { itemId: pinnedNote })
      const pin2 = await createMapPin(t, mapId, dmId, { itemId: pinnedNote })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: mapId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('mapPins', pin1.pinId),
          dbCtx.db.get('mapPins', pin2.pinId),
        ]),
      )
      expect(afterTrash[0]!.deletionTime).not.toBeNull()
      expect(afterTrash[1]!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: mapId,
        location: 'sidebar',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('mapPins', pin1.pinId),
          dbCtx.db.get('mapPins', pin2.pinId),
        ]),
      )
      expect(afterRestore[0]!.deletionTime).toBeNull()
      expect(afterRestore[1]!.deletionTime).toBeNull()
    })

    it('hard-deletes pins and extension on permanent delete', async () => {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { mapId } = await createGameMap(t, ctx.campaignId, dmId)
      const { noteId: pinnedNote } = await createNote(t, ctx.campaignId, dmId)
      const pin = await createMapPin(t, mapId, dmId, { itemId: pinnedNote })

      const extId = await t.run(async (dbCtx) => {
        const ext = await dbCtx.db
          .query('gameMaps')
          .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
          .unique()
        return ext!._id
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: mapId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: mapId,
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: fileId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('files', extId))
      expect(afterTrash).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: fileId,
        location: 'sidebar',
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: fileId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: fileId,
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: folderId,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) => dbCtx.db.get('folders', extId))
      expect(afterTrash).not.toBeNull()
      expect(afterTrash!.inheritShares).toBe(true)

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: folderId,
        location: 'sidebar',
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

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: folderId,
        location: 'trash',
      })
      await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: folderId,
      })

      const afterDelete = await t.run(async (dbCtx) =>
        Promise.all([dbCtx.db.get('sidebarItems', folderId), dbCtx.db.get('folders', extId)]),
      )
      expect(afterDelete[0]).toBeNull()
      expect(afterDelete[1]).toBeNull()
    })
  })

  describe('shares and bookmarks round-trip for all types', () => {
    async function testShareBookmarkRoundTrip(
      createItem: (
        ctx: Awaited<ReturnType<typeof setupCampaignContext>>,
      ) => Promise<{ itemId: string }>,
      itemType: string,
    ) {
      const ctx = await setupCampaignContext(t)
      const dmAuth = asDm(ctx)
      const dmId = ctx.dm.profile._id

      const { itemId } = await createItem(ctx)

      const { shareId } = await createSidebarShare(t, dmId, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId as any,
        sidebarItemType: itemType as any,
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'edit',
      })
      const { bookmarkId } = await createBookmark(t, ctx.player.profile._id, {
        campaignId: ctx.campaignId,
        sidebarItemId: itemId as any,
        campaignMemberId: ctx.player.memberId,
      })

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: itemId as any,
        location: 'trash',
      })

      const afterTrash = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItemShares', shareId),
          dbCtx.db.get('bookmarks', bookmarkId),
        ]),
      )
      expect(afterTrash[0]!.deletionTime).not.toBeNull()
      expect(afterTrash[1]!.deletionTime).not.toBeNull()

      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: itemId as any,
        location: 'sidebar',
      })

      const afterRestore = await t.run(async (dbCtx) =>
        Promise.all([
          dbCtx.db.get('sidebarItemShares', shareId),
          dbCtx.db.get('bookmarks', bookmarkId),
        ]),
      )
      expect(afterRestore[0]!.deletionTime).toBeNull()
      expect(afterRestore[0]!.permissionLevel).toBe('edit')
      expect(afterRestore[1]!.deletionTime).toBeNull()
    }

    it('note: shares and bookmarks survive trash round-trip', async () => {
      await testShareBookmarkRoundTrip(
        async (ctx) => {
          const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
          return { itemId: noteId }
        },
        'note',
      )
    })

    it('canvas: shares and bookmarks survive trash round-trip', async () => {
      await testShareBookmarkRoundTrip(
        async (ctx) => {
          const { canvasId } = await createCanvas(t, ctx.campaignId, ctx.dm.profile._id)
          return { itemId: canvasId }
        },
        'canvas',
      )
    })

    it('gameMap: shares and bookmarks survive trash round-trip', async () => {
      await testShareBookmarkRoundTrip(
        async (ctx) => {
          const { mapId } = await createGameMap(t, ctx.campaignId, ctx.dm.profile._id)
          return { itemId: mapId }
        },
        'gameMap',
      )
    })

    it('file: shares and bookmarks survive trash round-trip', async () => {
      await testShareBookmarkRoundTrip(
        async (ctx) => {
          const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
          return { itemId: fileId }
        },
        'file',
      )
    })

    it('folder: shares and bookmarks survive trash round-trip', async () => {
      await testShareBookmarkRoundTrip(
        async (ctx) => {
          const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
          return { itemId: folderId }
        },
        'folder',
      )
    })
  })
})
