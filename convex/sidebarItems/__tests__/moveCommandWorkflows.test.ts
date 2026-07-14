import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFolder,
  createNote,
  createSidebarShare,
  executeMoveCommand,
} from '../../_test/factories.helper'
import { expectPermissionDenied, expectValidationFailed } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('executeMoveCommand', () => {
  const t = createTestContext()

  it('moves item to a different parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: folderA } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder A',
    })
    const { folderId: folderB } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder B',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderA,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: folderB,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })
    expect(item.parentId).toBe(folderB)
  })

  it('moves into a duplicate-title destination without changing the title', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: sourceFolder, folderRowId: sourceFolderRow } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Source' },
    )
    const { folderId: destinationFolder, folderRowId: destinationFolderRow } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Destination',
      },
    )
    const { noteId: sourceNote, noteRowId: sourceNoteRow } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scene',
        parentId: sourceFolder,
      },
    )
    const { noteRowId: sourceSiblingRow } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scene 2',
        parentId: sourceFolder,
      },
    )
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      parentId: destinationFolder,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [sourceNote],
      targetParentId: destinationFolder,
    })

    const rows = await t.run(async (dbCtx) => ({
      moved: await dbCtx.db.get('sidebarItems', sourceNoteRow),
      sourceSibling: await dbCtx.db.get('sidebarItems', sourceSiblingRow),
    }))

    expect(rows.moved?.parentId).toBe(destinationFolderRow)
    expect(rows.moved?.name).toBe('Scene')
    expect(rows.sourceSibling?.parentId).toBe(sourceFolderRow)
    expect(rows.sourceSibling?.name).toBe('Scene 2')
  })

  it('moves item to trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    const { trash: trashItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(trashItems.some((i) => i.id === noteId)).toBe(true)
  })

  it('restores item from trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    const { active: sidebarItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })
    expect(sidebarItems.some((i) => i.id === noteId)).toBe(true)
  })

  it('rejects circular parent reference', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: parentFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Parent',
    })
    const { folderId: childFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Child',
      parentId: parentFolder,
    })

    await expectValidationFailed(
      executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [parentFolder],
        targetParentId: childFolder,
      }),
    )
  })

  it('moves item to root by setting parentId to null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Container',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [noteId],
      targetParentId: null,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })
    expect(item.parentId).toBeNull()
  })

  it('requires FULL_ACCESS permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      executeMoveCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [noteId],
        targetParentId: null,
        action: 'trash',
      }),
    )
  })

  it('requires DM to trash a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'full_access',
    })

    await expectPermissionDenied(
      executeMoveCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'trash',
      }),
    )
  })

  it('requires DM to restore a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'full_access',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignDomainId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await expectPermissionDenied(
      executeMoveCommand(playerAuth, {
        campaignId: ctx.campaignDomainId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'restore',
      }),
    )
  })
})
