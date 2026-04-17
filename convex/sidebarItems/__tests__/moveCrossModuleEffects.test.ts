import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'
import { makeYjsUpdateWithBlocks } from '../../yjsSync/__tests__/makeYjsUpdate.helper'

describe('moveSidebarItem cross-module effects', () => {
  const t = createTestContext()

  it('moving note into shared folder makes it visible via inheritance', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: sharedFolder } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Shared Folder',
      inheritShares: true,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sharedFolder,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Orphan Note',
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      parentId: sharedFolder,
    })

    const noteAfterMove = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(noteAfterMove.myPermissionLevel).toBe('view')
  })

  it('moving note out of shared folder removes inherited visibility', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: sharedFolder } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Shared Folder',
      inheritShares: true,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sharedFolder,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: sharedFolder,
      name: 'Inside Note',
    })

    const noteBefore = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(noteBefore.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: noteId,
      parentId: null,
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )
  })

  it('trashing folder sets root parentId to null, children stay linked', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Parent Folder',
    })
    const { noteId } = await createNote(t, ctx.campaignId, dmId, {
      parentId: folderId,
      name: 'Child Note',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: folderId,
      location: 'trash',
    })

    const afterTrash = await t.run(async (dbCtx) => ({
      folder: await dbCtx.db.get('sidebarItems', folderId),
      note: await dbCtx.db.get('sidebarItems', noteId),
    }))
    expect(afterTrash.folder).toBeDefined()
    expect(afterTrash.folder?.parentId).toBeNull()
    expect(afterTrash.note).toBeDefined()
    expect(afterTrash.note?.parentId).toBe(folderId)
  })

  it('moving folder into its own descendant is rejected', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: parent } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Parent',
    })
    const { folderId: child } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Child',
      parentId: parent,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: parent,
        parentId: child,
      }),
    )
  })

  it('player cannot trash a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Player Folder',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        location: 'trash',
      }),
    )
  })

  it('player cannot restore a folder from trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Restore Folder',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: folderId,
      location: 'trash',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        campaignId: ctx.campaignId,
        itemId: folderId,
        location: 'sidebar',
      }),
    )
  })

  it('moving a note re-syncs relative outgoing links', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: folderA } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Folder A',
    })
    const { folderId: folderB } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Folder B',
    })
    const { noteId: targetId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Target',
      parentId: folderA,
    })
    const { noteId: sourceId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Source',
      parentId: folderA,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
      update: makeYjsUpdateWithBlocks([
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '[[./Target]]', styles: {} }],
          children: [],
        },
      ]),
    })
    await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
    })

    let links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links).toHaveLength(1)
    expect(links[0].targetItemId).toBe(targetId)
    expect(links[0].query).toBe('./Target')

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: sourceId,
      parentId: folderB,
    })

    links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links).toHaveLength(1)
    expect(links[0].targetItemId).toBeNull()
    expect(links[0].query).toBe('./Target')
  })

  it('moving a folder re-syncs descendant notes with relative links', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const dmId = ctx.dm.profile._id

    const { folderId: worldId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'World',
    })
    const { folderId: districtId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'District',
      parentId: worldId,
    })
    const { folderId: elsewhereId } = await createFolder(t, ctx.campaignId, dmId, {
      name: 'Elsewhere',
    })
    const { noteId: targetId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Target',
      parentId: worldId,
    })
    const { noteId: sourceId } = await createNote(t, ctx.campaignId, dmId, {
      name: 'Source',
      parentId: districtId,
    })

    await dmAuth.mutation(api.yjsSync.mutations.pushUpdate, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
      update: makeYjsUpdateWithBlocks([
        {
          id: 'block-a',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '[[../Target]]', styles: {} }],
          children: [],
        },
      ]),
    })
    await dmAuth.mutation(api.notes.mutations.persistNoteBlocks, {
      campaignId: ctx.campaignId,
      documentId: sourceId,
    })

    let links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links).toHaveLength(1)
    expect(links[0].targetItemId).toBe(targetId)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      campaignId: ctx.campaignId,
      itemId: districtId,
      parentId: elsewhereId,
    })

    links = await t.run(async (dbCtx) => {
      return await dbCtx.db
        .query('noteLinks')
        .withIndex('by_campaign_source', (q) =>
          q.eq('campaignId', ctx.campaignId).eq('sourceNoteId', sourceId),
        )
        .collect()
    })
    expect(links).toHaveLength(1)
    expect(links[0].targetItemId).toBeNull()
    expect(links[0].query).toBe('../Target')
  })
})
