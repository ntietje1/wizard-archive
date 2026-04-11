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
    await createSidebarShare(t, dmId, {
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
    await createSidebarShare(t, dmId, {
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
    expect(afterTrash.folder!.parentId).toBeNull()
    expect(afterTrash.note!.parentId).toBe(folderId)
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
    await createSidebarShare(t, dmId, {
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
    await createSidebarShare(t, dmId, {
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
})
