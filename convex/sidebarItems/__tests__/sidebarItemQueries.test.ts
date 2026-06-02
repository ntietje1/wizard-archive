import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('sidebar item list queries', () => {
  const t = createTestContext()

  it('returns sidebar items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
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

    const items = await dmAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
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

    const items = await dmAuth.query(api.sidebarItems.queries.getTrashedSidebarItems, {
      campaignId: ctx.campaignId,
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

    const items = await playerAuth.query(api.sidebarItems.queries.getActiveSidebarItems, {
      campaignId: ctx.campaignId,
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
      status: 'trashed',
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
