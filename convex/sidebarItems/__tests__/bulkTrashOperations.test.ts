import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext, setupUser } from '../../_test/identities.helper'
import {
  executeMoveCommand,
  executeEmptyTrashCommand,
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
import { expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { testCampaignId } from '../../../shared/test/campaign-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'

describe('bulk trash operations', () => {
  const t = createTestContext()

  it('emptyTrash no-ops when trash is already empty', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const receipt = await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })
    const { trash: trashedItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(receipt.summary.affectedCount).toBe(0)
    expect(receipt.events).toEqual([])
    expect(trashedItems).toEqual([])
  })

  it('emptyTrash requires DM permission', async () => {
    const ctx = await setupCampaignContext(t)

    await expectPermissionDenied(
      executeEmptyTrashCommand(asPlayer(ctx), { campaignId: ctx.campaignDomainId }),
    )
  })

  it('emptyTrash rejects an unknown campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectPermissionDenied(
      executeEmptyTrashCommand(dmAuth, {
        campaignId: testCampaignId('missing-campaign'),
      }),
    )
  })

  it('emptyTrash with nested folder containing mixed item types', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: root, folderRowId: rootRowId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Root',
    })
    const { folderId: sub1, folderRowId: sub1RowId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Sub1',
      parentId: root,
    })
    const { folderId: sub2, folderRowId: sub2RowId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Sub2',
      parentId: sub1,
    })

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: root,
      name: 'Root Note',
    })
    const { fileRowId } = await createFile(t, ctx.campaignId, dmId, {
      parentId: sub1,
      name: 'Sub1 File',
    })
    const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, dmId, {
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

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [root],
      targetParentId: null,
      action: 'trash',
    })

    await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })

    const results = await t.run(async (dbCtx) => ({
      root: await dbCtx.db.get('sidebarItems', rootRowId),
      sub1: await dbCtx.db.get('sidebarItems', sub1RowId),
      sub2: await dbCtx.db.get('sidebarItems', sub2RowId),
      note: await dbCtx.db.get('sidebarItems', noteRowId),
      file: await dbCtx.db.get('sidebarItems', fileRowId),
      map: await dbCtx.db.get('sidebarItems', mapRowId),
      block: await dbCtx.db.get('blocks', blockDbId),
      share: await dbCtx.db.get('sidebarItemShares', shareId),
      bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
      pin: await dbCtx.db.get('mapPins', pinId),
    }))

    for (const [key, value] of Object.entries(results)) {
      expect(value, `${key} should be null`).toBeNull()
    }
  })

  it('emptyTrash with multiple independent root-level trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const items: Array<{ id: ResourceId; rowId: Id<'sidebarItems'> }> = []
    for (let i = 0; i < 5; i++) {
      const { noteId, noteRowId } = await createNote(t, ctx.campaignId, dmId, {
        name: `Note ${i}`,
      })
      items.push({ id: noteId, rowId: noteRowId })
    }
    for (let i = 0; i < 3; i++) {
      const { fileId, fileRowId } = await createFile(t, ctx.campaignId, dmId, {
        name: `File ${i}`,
      })
      items.push({ id: fileId, rowId: fileRowId })
    }

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: items.map((item) => item.id),
      targetParentId: null,
      action: 'trash',
    })

    await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })

    for (const item of items) {
      const result = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', item.rowId))
      expect(result).toBeNull()
    }
  })

  it('emptyTrash only affects the target campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const dm2 = await setupUser(t)
    const { campaignId: campaign2Id, campaignDomainId: campaign2DomainId } =
      await createCampaignWithDm(t, dm2.profile)

    const { noteId: note1, noteRowId: note1RowId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Campaign1 Note',
    })
    const { noteId: note2, noteRowId: note2RowId } = await createNote(
      t,
      campaign2Id,
      dm2.profile._id,
      {
        name: 'Campaign2 Note',
      },
    )

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [note1],
      targetParentId: null,
      action: 'trash',
    })
    await executeMoveCommand(dm2.authed, {
      campaignId: campaign2DomainId,
      sourceItemIds: [note2],
      targetParentId: null,
      action: 'trash',
    })

    await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })

    const [r1, r2] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', note1RowId),
      await dbCtx.db.get('sidebarItems', note2RowId),
    ])
    expect(r1).toBeNull()
    expect(r2).not.toBeNull()
    expect(r2!.status).toBe('trashed')
  })

  it('emptyTrash handles folder whose children were independently trashed', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Parent',
    })
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Child Note',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })
    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })

    const [folder, note] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', folderRowId),
      await dbCtx.db.get('sidebarItems', noteRowId),
    ])
    expect(folder).toBeNull()
    expect(note).toBeNull()
  })

  it('emptyTrash with deeply nested tree (5 levels)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const {
      folders,
      folderRowIds,
      leaf: leafId,
      leafRowId,
    } = await setupFolderTree(t, ctx.campaignId, dmId, { depth: 5, leafType: 'note' })

    const { blockDbId } = await createBlock(t, leafId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('deep-block'),
    })
    const { shareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: leafId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folders[0]],
      targetParentId: null,
      action: 'trash',
    })

    await executeEmptyTrashCommand(dmAuth, { campaignId: ctx.campaignDomainId })

    for (const fId of folderRowIds) {
      const result = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', fId))
      expect(result).toBeNull()
    }
    const [leafResult, blockResult, shareResult] = await t.run(async (dbCtx) => [
      await dbCtx.db.get('sidebarItems', leafRowId),
      await dbCtx.db.get('blocks', blockDbId),
      await dbCtx.db.get('sidebarItemShares', shareId),
    ])
    expect(leafResult).toBeNull()
    expect(blockResult).toBeNull()
    expect(shareResult).toBeNull()
  })
})
