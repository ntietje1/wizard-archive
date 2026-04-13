import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, setupCampaignContext, setupMultiPlayerContext } from '../../_test/identities.helper'
import {
  createBlock,
  createBlockShare,
  createBookmark,
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

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Root Folder',
      inheritShares: true,
    })
    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Nested Note',
    })
    const { fileId } = await createFile(t, ctx.campaignId, dmId, {
      name: 'Test File',
    })
    const { mapId } = await createGameMap(t, ctx.campaignId, dmId, {
      name: 'Battle Map',
    })

    const { blockDbId } = await createBlock(t, noteId, ctx.campaignId, dmId, {
      blockNoteId: testBlockNoteId('b1'),
    })
    const { blockShareId } = await createBlockShare(t, dmId, {
      campaignId: ctx.campaignId,
      noteId,
      blockId: blockDbId,
      campaignMemberId: p1.memberId,
    })

    const { shareId: folderShareId } = await createSidebarShare(t, dmId, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: p1.memberId,
    })
    const { shareId: noteShareId } = await createSidebarShare(t, dmId, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p2.memberId,
    })

    const { bookmarkId } = await createBookmark(t, p1.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: p1.memberId,
    })

    const { pinId } = await createMapPin(t, mapId, dmId, {
      itemId: noteId,
      x: 10,
      y: 20,
    })

    const { sessionId } = await createSession(t, ctx.campaignId, dmId)

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignId,
    })

    const cId = ctx.campaignId
    const results = await t.run(async (dbCtx) => {
      return {
        campaign: await dbCtx.db.get('campaigns', cId),
        folder: await dbCtx.db.get('sidebarItems', folderId),
        note: await dbCtx.db.get('sidebarItems', noteId),
        file: await dbCtx.db.get('sidebarItems', fileId),
        map: await dbCtx.db.get('sidebarItems', mapId),
        block: await dbCtx.db.get('blocks', blockDbId),
        blockShare: await dbCtx.db.get('blockShares', blockShareId),
        folderShare: await dbCtx.db.get('sidebarItemShares', folderShareId),
        noteShare: await dbCtx.db.get('sidebarItemShares', noteShareId),
        bookmark: await dbCtx.db.get('bookmarks', bookmarkId),
        pin: await dbCtx.db.get('mapPins', pinId),
        session: await dbCtx.db.get('sessions', sessionId),
      }
    })

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

    const remainingMembers = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', cId))
        .collect()
    })
    expect(remainingMembers).toHaveLength(0)
  })

  it('deletes trashed items as well as active items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { noteId: activeNoteId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Active Note',
    })
    const { noteId: trashedNoteId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Trashed Note',
      location: 'trash',
      deletionTime: Date.now(),
      deletedBy: dmId,
    })

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: ctx.campaignId,
    })

    const [active, trashed] = await t.run(async (dbCtx) => {
      return [
        await dbCtx.db.get('sidebarItems', activeNoteId),
        await dbCtx.db.get('sidebarItems', trashedNoteId),
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
      campaignId: cId,
    })

    const campaign = await t.run(async (dbCtx) => {
      return await dbCtx.db.get('campaigns', cId)
    })
    expect(campaign).toBeNull()
  })

  it('editor records are orphaned after campaign deletion (not cleaned up)', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const cId = ctx.campaignId

    await dmAuth.mutation(api.editors.mutations.setCurrentEditor, {
      campaignId: cId,
    })

    const editorBefore = await dmAuth.query(api.editors.queries.getCurrentEditor, {
      campaignId: cId,
    })
    expect(editorBefore).not.toBeNull()

    await dmAuth.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId: cId,
    })

    const remainingEditors = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('editor')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', cId))
        .collect()
    })
    expect(remainingEditors).toHaveLength(1)
  })
})
