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

    await createSidebarShare(t, ctx.dm.profile._id, {
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
      await dbCtx.db.delete(noteId)
    })

    await expectNotFound(dmAuth.query(api.sidebarItems.queries.getSidebarItem, { id: noteId }))
  })

  it('requires VIEW permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: noteId }))
  })

  it('returns expected shape with myPermissionLevel', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
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

describe('moveSidebarItem', () => {
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      parentId: folderB,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(item.parentId).toBe(folderB)
  })

  it('moves item to trash', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'sidebar',
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
      dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: parentFolder,
        parentId: childFolder,
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      parentId: null,
    })

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(item.parentId).toBeNull()
  })

  it('requires FULL_ACCESS permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: noteId,
        location: 'trash',
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
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: folderId,
        location: 'trash',
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
        itemId: folderId,
        location: 'sidebar',
      }),
    )
  })
})

describe('permanentlyDeleteSidebarItem', () => {
  const t = createTestContext()

  it('only works on trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: noteId,
      }),
    )
  })

  it('hard-deletes a trashed item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      itemId: noteId,
    })

    const deleted = await t.run(async (dbCtx) => {
      return await dbCtx.db.get(noteId)
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: folderId,
      location: 'trash',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
        itemId: folderId,
      }),
    )
  })

  it('allows player with full_access to permanently delete their trashed note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: noteId,
      location: 'trash',
    })

    await playerAuth.mutation(api.sidebarItems.mutations.permanentlyDeleteSidebarItem, {
      itemId: noteId,
    })

    const deleted = await t.run(async (dbCtx) => dbCtx.db.get(noteId))
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

    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: n1,
      location: 'trash',
    })
    await dmAuth.mutation(api.sidebarItems.mutations.moveSidebarItem, {
      itemId: n2,
      location: 'trash',
    })

    await dmAuth.mutation(api.sidebarItems.mutations.emptyTrashBin, {
      campaignId: ctx.campaignId,
    })

    const trashItems = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId: ctx.campaignId,
      location: 'trash',
    })
    expect(trashItems.length).toBe(0)

    const d1 = await t.run(async (dbCtx) => dbCtx.db.get(n1))
    const d2 = await t.run(async (dbCtx) => dbCtx.db.get(n2))
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
