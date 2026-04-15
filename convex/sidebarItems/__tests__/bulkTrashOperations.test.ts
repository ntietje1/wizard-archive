import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  createBlock,
  createBookmark,
  createCampaignWithDm,
  createFile,
  createFolder,
  createGameMap,
  createMapPin,
  createNote,
  createSidebarShare,
  setupFolderTree,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

describe('bulk trash operations', () => {
  const t = createTestContext()

  it('emptyTrashBin with nested folder containing mixed item types', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: root } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Root',
    })
    const { folderId: sub1 } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Sub1',
      parentId: root,
    })
    const { folderId: sub2 } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Sub2',
      parentId: sub1,
    })

    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: root,
      name: 'Root Note',
    })
    const { fileId } = await createFile(t, ctx.campaignId, dmId, {
      parentId: sub1,
      name: 'Sub1 File',
    })
    const { mapId } = await createGameMap(t, ctx.campaignId, dmId, {
      parentId: sub2,
      name: 'Sub2 Map',
    })

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('bulk-b1'),
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })
    const { bookmarkId } = await createBookmark(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: ctx.player.memberId,
    })
    const { pinId } = await createMapPin(t, mapId, {
      itemId: noteId,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: root,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const results = await t.run(async (dbCtx) => ({
      root: await dbCtx.db.get('sidebarItems', root),
      sub1: await dbCtx.db.get('sidebarItems', sub1),
      sub2: await dbCtx.db.get('sidebarItems', sub2),
      note: await dbCtx.db.get('sidebarItems', noteId),
      file: await dbCtx.db.get('sidebarItems', fileId),
      map: await dbCtx.db.get('sidebarItems', mapId),
      block: await dbCtx.db.get('blocks', blockDbId),
      share: await dbCtx.db.get('sidebarItemShares', shareId),
      bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      pin: await dbCtx.db.get('mapPins', pinId),
    }))

    for (const [key, value] of Object.entries(results)) {
      expect(value, `${key} should be null`).toBeNull()
    }
  })

  it('emptyTrashBin with multiple independent root-level trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const items: Array<{ id: Id<'sidebarItems'> }> = []
    for (let i = 0; i < 5; i++) {
      const { noteId } = await createNote(t, ctx.campaignId, dmId, {
        name: `Note ${i}`,
      })
      items.push({ id: noteId })
    }
    for (let i = 0; i < 3; i++) {
      const { fileId } = await createFile(t, ctx.campaignId, dmId, {
        name: `File ${i}`,
      })
      items.push({ id: fileId })
    }

    for (const item of items) {
      await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: item.id,
        location: 'trash',
      })
    }

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    for (const item of items) {
      const result = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', item.id))
      expect(result).toBeNull()
    }
  })

  it('emptyTrashBin only affects the target campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const dm2 = await setupUser(t)
    const { campaignId: campaign2Id } = await createCampaignWithDm(t, dm2.profile)

    const { noteId: note1 } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Campaign1 Note',
    })
    const { noteId: note2 } = await createNote(t, campaign2Id, dm2.profile._id, {
      name: 'Campaign2 Note',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: note1,
      location: 'trash',
    })
    await dm2.authed.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: campaign2Id,
      itemId: note2,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const [r1, r2] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', note1),
      await dbCtx.db.get('sidebarItems', note2),
    ])
    expect(r1).toBeNull()
    expect(r2).not.toBeNull()
    expect(r2!.location).toBe('trash')
  })

  it('emptyTrashBin handles folder whose children were independently trashed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Parent',
    })
    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Child Note',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: folderId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const [folder, note] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', folderId),
      await dbCtx.db.get('sidebarItems', noteId),
    ])
    expect(folder).toBeNull()
    expect(note).toBeNull()
  })

  it('emptyTrashBin with deeply nested tree (5 levels)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folders, leaf: leafId } = await setupFolderTree(t, ctx.campaignId, dmId, {
      depth: 5,
      leafType: 'note',
    })

    const { blockDbId } = await createBlock(t, leafId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('deep-block'),
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: leafId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: folders[0],
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    for (const fId of folders) {
      const result = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', fId))
      expect(result).toBeNull()
    }
    const [leafResult, blockResult, shareResult] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', leafId),
      await dbCtx.db.get('blocks', blockDbId),
      await dbCtx.db.get('sidebarItemShares', shareId),
    ])
    expect(leafResult).toBeNull()
    expect(blockResult).toBeNull()
    expect(shareResult).toBeNull()
  })
})
