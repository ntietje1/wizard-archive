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

describe('getSidebarItemsByLocation', () => {
  const t = createTestContext()

  it('returns sidebar items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    expect(items.length).toBe(2)
  })

  it('excludes trash items from sidebar location', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    expect(items.length).toBe(1)
  })

  it('returns trash items for trash location', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      location: 'trash',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'trash',
    })

    expect(items.length).toBe(1)
  })

  it('player sees items with correct permission levels', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId: sharedNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: unsharedNote } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sharedNote,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const items = await playerAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })

    const shared = items.find((i) => i._id === sharedNote)
    const unshared = items.find((i) => i._id === unsharedNote)

    expect(shared).toBeDefined()
    expect(shared!.myPermissionLevel).toBe('view')
    expect(unshared).toBeDefined()
    expect(unshared!.myPermissionLevel).toBe('none')
  })
})

describe('getSidebarItemsByParent', () => {
  const t = createTestContext()

  it('returns items under a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Parent Folder',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: folderId,
    })

    expect(items.length).toBe(2)
  })

  it('returns root items when parentId is null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })

    expect(items.length).toBe(2)
  })

  it('excludes soft-deleted items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
      location: 'trash',
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })

    expect(items.length).toBe(1)
  })
})

describe('getSidebarItem', () => {
  const t = createTestContext()

  it('returns item with ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })

    expect(result._id).toBe(noteId)
    expect(result.ancestors.length).toBeGreaterThan(0)
    expect(result.ancestors[0]._id).toBe(folderId)
  })

  it('throws NOT_FOUND for nonexistent id', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteId)
    })

    await expectNotFound(
      dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )
  })

  it('requires VIEW permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )
  })

  it('returns expected shape with myPermissionLevel', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })

    expect(result).toHaveProperty('_id')
    expect(result).toHaveProperty('name')
    expect(result).toHaveProperty('slug')
    expect(result).toHaveProperty('myPermissionLevel')
    expect(result).toHaveProperty('shares')
    expect(result).toHaveProperty('isBookmarked')
    expect(result).toHaveProperty('ancestors')
  })
})

describe('getSidebarItemBySlug', () => {
  const t = createTestContext()

  it('finds item by slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, slug } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignId,
      slug,
    })

    expect(result).not.toBeNull()
    expect(result!._id).toBe(noteId)
  })

  it('returns null for nonexistent slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignId,
      slug: 'does-not-exist',
    })

    expect(result).toBeNull()
  })
})

describe('moveSidebarItems', () => {
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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
    expect(rows.moved?.name).toBe('Scene 2')
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
      dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [sourceNote],
        targetParentId: destinationFolder,
      }),
    )

    const movedIds = await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceNote],
      targetParentId: destinationFolder,
      decisions: [{ sourceItemId: sourceNote, action: 'replace' }],
    })

    const rows = await t.run(async (dbCtx) => ({
      source: await dbCtx.db.get('sidebarItems', sourceNote),
      destination: await dbCtx.db.get('sidebarItems', destinationNote),
    }))

    expect(movedIds.movedSourceItemIds).toEqual([sourceNote])
    expect(movedIds.mergedSourceItemIds).toEqual([])
    expect(movedIds.skippedSourceItemIds).toEqual([])
    expect(rows.source?.parentId).toBe(destinationFolder)
    expect(rows.source?.location).toBe('sidebar')
    expect(rows.source?.name).toBe('Scene')
    expect(rows.destination?.location).toBe('trash')
    expect(rows.destination?.deletionTime).toEqual(expect.any(Number))
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

    const movedIds = await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceFolder],
      targetParentId: null,
      decisions: [
        { sourceItemId: sourceFolder, action: 'replace' },
        { sourceItemId: skippedChild, action: 'skip' },
      ],
    })

    const rows = await t.run(async (dbCtx) => ({
      sourceFolder: await dbCtx.db.get('sidebarItems', sourceFolder),
      skippedChild: await dbCtx.db.get('sidebarItems', skippedChild),
    }))

    expect(movedIds.movedSourceItemIds).toEqual([])
    expect(movedIds.mergedSourceItemIds).toEqual([sourceFolder])
    expect(movedIds.skippedSourceItemIds).toEqual([skippedChild])
    expect(rows.sourceFolder?.location).toBe('sidebar')
    expect(rows.skippedChild?.location).toBe('sidebar')
    expect(rows.skippedChild?.parentId).toBe(sourceFolder)
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [sourceFolder],
      targetParentId: null,
      decisions: [
        { sourceItemId: sourceFolder, action: 'replace' },
        { sourceItemId: movedChild, action: 'keepBoth' },
      ],
    })

    const rows = await t.run(async (dbCtx) => ({
      sourceFolder: await dbCtx.db.get('sidebarItems', sourceFolder),
      movedChild: await dbCtx.db.get('sidebarItems', movedChild),
    }))

    expect(rows.movedChild?.parentId).toBe(destinationFolder)
    expect(rows.movedChild?.location).toBe('sidebar')
    expect(rows.sourceFolder?.location).toBe('trash')
    expect(rows.sourceFolder?.deletionTime).toEqual(expect.any(Number))
  })

  it('moves item to trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    const trashItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'trash',
    })
    expect(trashItems.some((i) => i._id === noteId)).toBe(true)
  })

  it('restores item from trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'restore',
    })

    const sidebarItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'sidebar',
    })
    expect(sidebarItems.some((i) => i._id === noteId)).toBe(true)
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
      dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
        targetParentId: null,
        action: 'restore',
      }),
    )
  })
})

describe('create item with parentTarget paths', () => {
  const t = createTestContext()

  it('creates missing parent folders transactionally for notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: null,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    const arcOne = rootItems.find((item) => item.name === 'Arc One')

    expect(arcOne?.type).toBe('folder')

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOne!._id,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!._id,
    })
    const createdNote = arcTwoChildren.find((item) => item._id === result.noteId)

    expect(createdNote?.name).toBe('Leaf Note')
  })

  it('rolls back created parent folders when note creation fails after path resolution', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: '   ',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Arc One', 'Arc Two'],
        },
      }),
    )

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    const arcOne = rootItems.find((item) => item.name === 'Arc One')

    expect(arcOne).toBeUndefined()
  })

  it('creates missing path folders under a provided parentTarget base for notes', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const arcOne = baseChildren.find((item) => item.name === 'Arc One')

    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(arcOne?.type).toBe('folder')
    expect(baseChildren.some((item) => item._id === result.noteId)).toBe(false)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOne!._id,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)
    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!._id,
    })
    const createdNote = arcTwoChildren.find((item) => item._id === result.noteId)

    expect(createdNote?.name).toBe('Leaf Note')
  })

  it('reuses existing path folders for folder creation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: arcOneId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
    })
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc Two',
      parentId: arcOneId,
    })

    await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'Leaf Folder',
      parentTarget: {
        kind: 'path',
        baseParentId: null,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.filter((item) => item.name === 'Arc One')).toHaveLength(1)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOneId,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!._id,
    })
    expect(arcTwoChildren.some((item) => item.name === 'Leaf Folder')).toBe(true)
  })

  it('reuses existing path folders under a provided parentTarget base for folder creation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })
    const { folderId: arcOneId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
      parentId: baseFolderId,
    })
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc Two',
      parentId: arcOneId,
    })

    await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'Leaf Folder',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['Arc One', 'Arc Two'],
      },
    })

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const arcOne = baseChildren.find((item) => item.name === 'Arc One')

    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(arcOne?._id).toBe(arcOneId)

    const arcOneChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcOneId,
    })
    const arcTwo = arcOneChildren.find((item) => item.name === 'Arc Two')

    expect(arcOneChildren.filter((item) => item.name === 'Arc Two')).toHaveLength(1)
    expect(arcTwo?.type).toBe('folder')

    const arcTwoChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: arcTwo!._id,
    })
    expect(arcTwoChildren.some((item) => item.name === 'Leaf Folder')).toBe(true)
  })

  it('rejects path segments that collide with non-folder items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['Arc One', 'Arc Two'],
        },
      }),
    )
  })

  it('rejects path segment collisions under a provided parentTarget base', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Arc One',
      parentId: baseFolderId,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: baseFolderId,
          pathSegments: ['Arc One', 'Arc Two'],
        },
      }),
    )

    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Arc One')).toBe(false)

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    expect(baseChildren.filter((item) => item.name === 'Arc One')).toHaveLength(1)
    expect(baseChildren.find((item) => item.name === 'Arc One')?.type).toBe('note')
  })

  it('supports dot traversal in explicit parentTarget paths', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: baseFolderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Base Folder',
    })

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: baseFolderId,
        pathSegments: ['.', 'Nested'],
      },
    })

    const baseChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: baseFolderId,
    })
    const nestedFolder = baseChildren.find((item) => item.name === 'Nested')

    expect(nestedFolder?.type).toBe('folder')

    const nestedChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: nestedFolder!._id,
    })
    expect(nestedChildren.some((item) => item._id === result.noteId)).toBe(true)
  })

  it('supports dotdot traversal in explicit parentTarget paths', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId: worldId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'World',
    })
    const { folderId: regionId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Region',
      parentId: worldId,
    })

    const result = await dmAuth.mutation(api.notes.mutations.createNote, {
      campaignId: ctx.campaignId,
      name: 'Leaf Note',
      parentTarget: {
        kind: 'path',
        baseParentId: regionId,
        pathSegments: ['..', 'Archive'],
      },
    })

    const worldChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: worldId,
    })
    const archiveFolder = worldChildren.find((item) => item.name === 'Archive')

    expect(archiveFolder?.type).toBe('folder')

    const archiveChildren = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: archiveFolder!._id,
    })
    expect(archiveChildren.some((item) => item._id === result.noteId)).toBe(true)
  })

  it('rejects explicit parentTarget paths that traverse above root', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.notes.mutations.createNote, {
        campaignId: ctx.campaignId,
        name: 'Leaf Note',
        parentTarget: {
          kind: 'path',
          baseParentId: null,
          pathSegments: ['..', 'Archive'],
        },
      }),
    )
    const rootItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignId,
      parentId: null,
    })
    expect(rootItems.some((item) => item.name === 'Archive')).toBe(false)
  })
})

describe('permanentlyDeleteSidebarItems', () => {
  const t = createTestContext()

  it('only works on trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [noteId],
      }),
    )
  })

  it('hard-deletes a trashed item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
    })

    const deleted = await t.run(async (dbCtx) => {
      return await dbCtx.db.get('sidebarItems', noteId)
    })
    expect(deleted).toBeNull()
  })

  it('requires DM for permanently deleting folders', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'full_access',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [folderId],
      targetParentId: null,
      action: 'trash',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItems, {
        campaignId: ctx.campaignId,
        sourceItemIds: [folderId],
      }),
    )
  })

  it('allows player with full_access to permanently delete their trashed note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
      targetParentId: null,
      action: 'trash',
    })

    await playerAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [noteId],
    })

    const deleted = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', noteId))
    expect(deleted).toBeNull()
  })
})

describe('emptyTrashBin', () => {
  const t = createTestContext()

  it('deletes all trash items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId: n1 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: n2 } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItems, {
      campaignId: ctx.campaignId,
      sourceItemIds: [n1, n2],
      targetParentId: null,
      action: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const trashItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'trash',
    })
    expect(trashItems.length).toBe(0)

    const d1 = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', n1))
    const d2 = await t.run(async (dbCtx) => dbCtx.db.get('sidebarItems', n2))
    expect(d1).toBeNull()
    expect(d2).toBeNull()
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})
