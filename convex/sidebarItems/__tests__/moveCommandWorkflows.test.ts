import { executeTestFileSystemCommand } from '../../_test/filesystemCommand.helper'
import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFolder,
  createNote,
  createSidebarShare,
  executeMoveCommand,
  filesystemEventItemIds,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: folderB,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.parentId).toBe(folderB)
  })

  it('moves and renames an item atomically using destination-parent validation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: sourceFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source',
    })
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Destination',
      },
    )
    const { noteId: sourceNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      slug: 'scene-source',
      parentId: sourceFolder,
    })
    const { noteId: sourceSibling } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene 2',
      slug: 'scene-2-source',
      parentId: sourceFolder,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      slug: 'scene-destination',
      parentId: destinationFolder,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceNote],
      targetParentId: destinationFolder,
      decisions: [{ sourceItemId: sourceNote, action: 'keepBoth' }],
    })

    const rows = await t.run(async (dbCtx) => ({
      moved: await dbCtx.db.get('sidebarItems', sourceNote),
      sourceSibling: await dbCtx.db.get('sidebarItems', sourceSibling),
    }))

    expect(rows.moved?.parentId).toBe(destinationFolder)
    expect(rows.moved?.name).toBe('Scene 1')
    expect(rows.sourceSibling?.parentId).toBe(sourceFolder)
    expect(rows.sourceSibling?.name).toBe('Scene 2')
  })

  it('batch-replaces by trashing the destination and moving the source into place', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: sourceFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Source',
    })
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Destination',
      },
    )
    const { noteId: sourceNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      slug: 'batch-scene-source',
      parentId: sourceFolder,
    })
    const { noteId: destinationNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
      slug: 'batch-scene-destination',
      parentId: destinationFolder,
    })

    await expectValidationFailed(
      executeMoveCommand(dmAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [sourceNote],
        targetParentId: destinationFolder,
      }),
    )

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceNote],
      targetParentId: destinationFolder,
      decisions: [{ sourceItemId: sourceNote, action: 'replace' }],
    })

    const rows = await t.run(async (dbCtx) => ({
      source: await dbCtx.db.get('sidebarItems', sourceNote),
      destination: await dbCtx.db.get('sidebarItems', destinationNote),
    }))

    expect(rows.source?.parentId).toBe(destinationFolder)
    expect(rows.source?.location).toBe('sidebar')
    expect(rows.source?.name).toBe('Scene')
    expect(rows.destination?.status).toBe('trashed')
    expect(rows.destination?.deletionTime).toEqual(expect.any(Number))
  })

  it('records move replace receipts as undoable transactions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Destination' },
    )
    const { noteId: sourceNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scene',
    })
    const { noteId: replacedDestinationId } = await createNote(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scene',
        parentId: destinationFolder,
      },
    )

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'move', itemIds: [sourceNote], targetParentId: destinationFolder },
      decisions: [{ sourceItemId: sourceNote, action: 'replace' }],
    })

    expect(
      receipt.events.filter((event) => event.type === 'replaced').map((event) => event.itemId),
    ).toEqual([replacedDestinationId])
    expect(receipt.undoable).toBe(true)
  })

  it('batch folder merge leaves non-empty skipped source folders in sidebar', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: sourceFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
      slug: 'merge-source',
    })
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scenes',
        slug: 'merge-destination',
      },
    )
    const { noteId: skippedChild } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Skipped',
      parentId: sourceFolder,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Skipped',
      parentId: destinationFolder,
    })

    const movedIds = await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceFolder],
      targetParentId: null,
      decisions: [
        { sourceItemId: sourceFolder, action: 'mergeFolder' },
        { sourceItemId: skippedChild, action: 'skip' },
      ],
    })

    const rows = await t.run(async (dbCtx) => ({
      sourceFolder: await dbCtx.db.get('sidebarItems', sourceFolder),
      skippedChild: await dbCtx.db.get('sidebarItems', skippedChild),
    }))

    expect(filesystemEventItemIds(movedIds, 'moved')).toEqual([])
    expect(filesystemEventItemIds(movedIds, 'mergedFolder')).toEqual([destinationFolder])
    expect(filesystemEventItemIds(movedIds, 'skipped')).toEqual([skippedChild])
    expect(rows.sourceFolder?.location).toBe('sidebar')
    expect(rows.skippedChild?.location).toBe('sidebar')
    expect(rows.skippedChild?.parentId).toBe(sourceFolder)
  })

  it('records move folder merge receipts as undoable transactions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId: sourceFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
    })
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      { name: 'Scenes' },
    )

    const receipt = await executeTestFileSystemCommand(dmAuth, {
      campaignId: ctx.campaignId,
      command: { type: 'move', itemIds: [sourceFolder], targetParentId: null },
      decisions: [{ sourceItemId: sourceFolder, action: 'mergeFolder' }],
    })

    expect(
      receipt.events.filter((event) => event.type === 'mergedFolder').map((event) => event.itemId),
    ).toEqual([destinationFolder])
    expect(receipt.undoable).toBe(true)
  })

  it('batch folder merge trashes empty source folders after all children move', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: sourceFolder } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Scenes',
      slug: 'empty-merge-source',
    })
    const { folderId: destinationFolder } = await createFolder(
      t,
      ctx.campaignId,
      ctx.dm.profile._id,
      {
        name: 'Scenes',
        slug: 'empty-merge-destination',
      },
    )
    const { noteId: movedChild } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Ambush',
      parentId: sourceFolder,
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceFolder],
      targetParentId: null,
      decisions: [{ sourceItemId: sourceFolder, action: 'mergeFolder' }],
    })

    const rows = await t.run(async (dbCtx) => ({
      sourceFolder: await dbCtx.db.get('sidebarItems', sourceFolder),
      movedChild: await dbCtx.db.get('sidebarItems', movedChild),
    }))

    expect(rows.movedChild?.parentId).toBe(destinationFolder)
    expect(rows.movedChild?.location).toBe('sidebar')
    expect(rows.sourceFolder?.status).toBe('trashed')
    expect(rows.sourceFolder?.deletionTime).toEqual(expect.any(Number))
  })

  it('moves item to trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    const { trash: trashItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
    })
    expect(trashItems.some((i) => i.id === noteId)).toBe(true)
  })

  it('restores item from trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await executeMoveCommand(dmAuth, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    const { active: sidebarItems } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignId,
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
        campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
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
        campaignId: ctx.campaignId,
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
        campaignId: ctx.campaignId,
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
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await expectPermissionDenied(
      executeMoveCommand(playerAuth, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'restore',
      }),
    )
  })
})
