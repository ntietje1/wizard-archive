import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFile,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('sidebar item list queries', () => {
  const t = createTestContext()

  it('returns sidebar items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(items.length).toBe(2)
  })

  it('excludes trashed items from active results', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const { active: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(items.length).toBe(1)
  })

  it('returns trashed items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      status: 'trashed',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const { trash: items } = await dmAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(items.length).toBe(1)
  })

  it('player active list returns only viewable items', async () => {
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

    const { active: items } = await playerAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    const shared = items.find((i) => i.id === sharedNote)
    const unshared = items.find((i) => i.id === unsharedNote)

    expect(shared).toBeDefined()
    expect(shared!.myPermissionLevel).toBe('view')
    expect(shared!.shares).toEqual([])
    expect(unshared).toBeUndefined()
  })

  it('player active list excludes shared descendants under unshared parents', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { active: items } = await playerAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(items.find((item) => item.id === folderId)).toBeUndefined()
    expect(items.find((item) => item.id === noteId)).toBeUndefined()
  })

  it('player trash excludes private trashed files before URL enhancement', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const deletionTime = Date.now()
    const [fileStorageId, previewStorageId] = await t.run(async (dbCtx) => {
      return await Promise.all([
        dbCtx.storage.store(new Blob(['private file'])),
        dbCtx.storage.store(new Blob(['private preview'])),
      ])
    })
    const { fileId: privateFileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      deletedBy: ctx.dm.profile._id,
      deletionTime,
      previewStorageId,
      status: 'trashed',
      storageId: fileStorageId,
    })
    const { noteId: sharedNoteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      deletedBy: ctx.dm.profile._id,
      deletionTime: deletionTime + 1,
      status: 'trashed',
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: sharedNoteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const { trash: items } = await playerAuth.query(api.sidebarItems.queries.getSidebarItems, {
      campaignId: ctx.campaignDomainId,
    })

    expect(items.map((item) => item.id)).toEqual([sharedNoteId])
    expect(items.some((item) => item.id === privateFileId)).toBe(false)
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
      campaignId: ctx.campaignDomainId,
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
      campaignId: ctx.campaignDomainId,
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
      status: 'trashed',
    })

    const items = await dmAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignDomainId,
      parentId: null,
    })

    expect(items.length).toBe(1)
  })

  it('does not list private children or children of a private parent for players', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const rootItems = await playerAuth.query(api.sidebarItems.queries.getSidebarItemsByParent, {
      campaignId: ctx.campaignDomainId,
      parentId: null,
    })
    const privateFolderChildren = await playerAuth.query(
      api.sidebarItems.queries.getSidebarItemsByParent,
      {
        campaignId: ctx.campaignDomainId,
        parentId: folderId,
      },
    )

    expect(rootItems).toEqual([])
    expect(privateFolderChildren).toEqual([])
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
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })

    expect(result.id).toBe(noteId)
    expect(result.ancestors.length).toBeGreaterThan(0)
    expect(result.ancestors[0].id).toBe(folderId)
  })

  it('throws NOT_FOUND for nonexistent id', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId, noteRowId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', noteRowId)
    })

    await expectNotFound(
      dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignDomainId,
        id: noteId,
      }),
    )
  })

  it('throws NOT_FOUND when an extension row is missing', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId, folderRowId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db
        .query('folders')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', folderRowId))
        .unique()
      if (!folder) throw new Error('Missing setup folder')
      await dbCtx.db.delete('folders', folder._id)
    })

    await expectNotFound(
      dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignDomainId,
        id: folderId,
      }),
    )
  })

  it('requires VIEW permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignDomainId,
        id: noteId,
      }),
    )
  })

  it('requires VIEW permission for every ancestor', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignDomainId,
        id: noteId,
      }),
    )
  })

  it('returns expected shape with myPermissionLevel', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignDomainId,
      id: noteId,
    })

    expect(result).toHaveProperty('id')
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
      campaignId: ctx.campaignDomainId,
      slug,
    })

    expect(result).not.toBeNull()
    expect(result!.id).toBe(noteId)
  })

  it('returns null for nonexistent slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignDomainId,
      slug: 'does-not-exist',
    })

    expect(result).toBeNull()
  })

  it('returns null for a shared item under an unshared ancestor', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId, slug } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const result = await playerAuth.query(api.sidebarItems.queries.getSidebarItemBySlug, {
      campaignId: ctx.campaignDomainId,
      slug,
    })

    expect(result).toBeNull()
  })
})

describe('resolveSidebarItemAccess', () => {
  const t = createTestContext()

  it('returns available content for readable item ids', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'id', id: noteId },
    })

    expect(result.status).toBe('available')
    if (result.status !== 'available') throw new Error('Expected available result')
    expect(result.item.id).toBe(noteId)
    expect(result.item).toHaveProperty('content')
  })

  it('returns no resource data for existing unshared item ids', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Private note',
    })

    const result = await playerAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'id', id: noteId },
    })

    expect(result).toEqual({ status: 'not_shared' })
  })

  it('returns not_found for missing slugs', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'slug', slug: 'missing-slug' },
    })

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns no resource data for existing unshared slugs', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { slug } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Private slug note',
    })

    const result = await playerAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'slug', slug },
    })

    expect(result).toEqual({ status: 'not_shared' })
  })

  it('does not expose preview or share metadata for denied files', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const previewStorageId = await t.run(async (dbCtx) =>
      dbCtx.storage.store(new Blob(['private preview'])),
    )
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      previewStorageId,
    })
    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.dm.memberId,
      permissionLevel: 'view',
    })

    const result = await playerAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'id', id: fileId },
    })

    expect(result).toEqual({ status: 'not_shared' })
  })

  it('returns an explicit trashed state without resource data', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      deletedBy: ctx.dm.profile._id,
      deletionTime: Date.now(),
      status: 'trashed',
    })

    const result = await dmAuth.query(api.sidebarItems.queries.resolveSidebarItemAccess, {
      campaignId: ctx.campaignDomainId,
      lookup: { kind: 'id', id: noteId },
    })

    expect(result).toEqual({ status: 'trashed' })
  })
})
