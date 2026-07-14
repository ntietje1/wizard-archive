import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext, setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
  executeMoveCommand,
  createFile,
  createFolder,
  createGameMap,
  createMapPin,
  createNote,
  createSession,
  createSidebarShare,
  testBlockNoteId,
} from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('campaign deletion cascade', () => {
  const t = createTestContext()

  it('deletes all sidebar items and their dependents across every table', async () => {
    const ctx = await setupMultiPlayerContext(t, 2)
    const dmAuth = ctx.dm.authed
    const dmId = ctx.dm.profile._id
    const p1 = ctx.players[0]
    const p2 = ctx.players[1]

    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Root Folder',
      inheritShares: true,
    })
    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Nested Note',
    })
    const { fileId, fileRowId } = await createFile(t, ctx.campaignId, dmId, {
      name: 'Test File',
    })
    const { mapId, mapRowId } = await createGameMap(t, ctx.campaignId, dmId, {
      name: 'Battle Map',
    })

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, {
      blockNoteId: testBlockNoteId('b1'),
    })
    const { blockShareId } = await createBlockShare(t, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: p1.memberId,
    })

    const { shareId: folderShareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: p1.memberId,
    })
    const { shareId: noteShareId } = await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p2.memberId,
    })

    const { bookmarkId } = await createBookmark(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: p1.memberId,
    })

    const { pinId } = await createMapPin(t, mapId, {
      itemId: noteId,
      x: 10,
      y: 20,
    })

    const { sessionId } = await createSession(t, ctx.campaignId)
    const moveReceipt = await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [fileId],
      targetParentId: folderId,
    })
    expect(moveReceipt.transactionId).not.toBeNull()

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    const cId = ctx.campaignId
    const results = await t.run(async (dbCtx) => {
      return {
        campaign: await dbCtx.db.get('campaigns', cId),
        folder: await dbCtx.db.get('sidebarItems', folderRowId),
        note: await dbCtx.db.get('sidebarItems', noteRowId),
        file: await dbCtx.db.get('sidebarItems', fileRowId),
        map: await dbCtx.db.get('sidebarItems', mapRowId),
        block: await dbCtx.db.get('blocks', blockDbId),
        blockShare: await dbCtx.db.get('blockShares', blockShareId),
        folderShare: await dbCtx.db.get('sidebarItemShares', folderShareId),
        noteShare: await dbCtx.db.get('sidebarItemShares', noteShareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
        pin: await dbCtx.db.get('mapPins', pinId),
        session: await dbCtx.db.get('sessions', sessionId),
        transaction: await dbCtx.db
          .query('filesystemTransactions')
          .withIndex('by_operationUuid', (query) =>
            query.eq('operationUuid', moveReceipt.transactionId!),
          )
          .unique(),
      }
    })

    expect(results.campaign).toBeNull()
    expect(results.folder).toBeNull()
    expect(results.note).toBeNull()
    expect(results.file).toBeNull()
    expect(results.map).toBeNull()
    expect(results.block).toBeNull()
    expect(results.blockShare).toBeNull()
    expect(results.folderShare).toBeNull()
    expect(results.noteShare).toBeNull()
    expect(results.bookmark).toBeNull()
    expect(results.pin).toBeNull()
    expect(results.session).toBeNull()
    expect(results.transaction).toBeNull()

    const remainingMembers = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', cId))
        .collect()
    })
    expect(remainingMembers).toHaveLength(0)

    const remainingTransactions = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('filesystemTransactions')
        .withIndex('by_campaign_actor', (q) => q.eq('campaignId', cId))
        .collect()
    })
    expect(remainingTransactions).toHaveLength(0)
  })

  it('deletes trashed items as well as active items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { noteRowId: activeNoteRowId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Active Note',
    })
    const { noteRowId: trashedNoteRowId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Trashed Note',
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.memberDomainId,
    })

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    const [active, trashed] = await t.run(async (dbCtx) => {
      return [
        await dbCtx.db.get('sidebarItems', activeNoteRowId),
        await dbCtx.db.get('sidebarItems', trashedNoteRowId),
      ]
    })
    expect(active).toBeNull()
    expect(trashed).toBeNull()
  })

  it('handles campaign with no content gracefully', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const cId = ctx.campaignId

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    const campaign = await t.run(async (dbCtx) => {
      return await dbCtx.db.get('campaigns', cId)
    })
    expect(campaign).toBeNull()
  })

  it('deletes editor records for the campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const cId = ctx.campaignId

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: ctx.campaignDomainId,
    })

    const editorBefore = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: ctx.campaignDomainId,
    })
    expect(editorBefore).not.toBeNull()

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignDomainId,
    })

    const remainingEditors = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editor')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', cId))
        .collect()
    })
    expect(remainingEditors).toHaveLength(0)
  })
})
