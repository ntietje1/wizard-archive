import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import {
  createFile,
  createFolder,
  createNote,
  createSidebarShare,
} from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectNotFound,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('createFolder', () => {
  const t = createTestContext()

  it('creates a folder with a unique slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'My Folder',
      parentId: null,
    })

    expect(result.folderId).toBeDefined()
    expect(result.slug).toContain('my-folder')

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get("folders", result.folderId)
      expect(folder).not.toBeNull()
      expect(folder!.name).toBe('My Folder')
      expect(folder!.parentId).toBeNull()
      expect(folder!.campaignId).toBe(ctx.campaignId)
    })
  })

  it('DM can create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'Root Folder',
      parentId: null,
    })
    expect(result.folderId).toBeDefined()
  })

  it('player cannot create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: 'Player Root',
        parentId: null,
      }),
    )
  })

  it('player with edit permission on parent cannot create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId: parentId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: parentId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: 'Child Folder',
        parentId,
      }),
    )
  })

  it('player with view permission on parent cannot create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId: parentId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: parentId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: 'Child Folder',
        parentId,
      }),
    )
  })

  it('player with FULL_ACCESS on parent can create inside', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId: parentId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: parentId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'Child Folder',
      parentId,
    })
    expect(result.folderId).toBeDefined()
  })

  it('validates name format', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: '',
        parentId: null,
      }),
    )
  })

  it('validates name uniqueness under same parent', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await dmAuth.mutation(api.folders.mutations.createFolder, {
      campaignId: ctx.campaignId,
      name: 'Duplicate',
      parentId: null,
    })

    await expectValidationFailed(
      dmAuth.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: 'Duplicate',
        parentId: null,
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.folders.mutations.createFolder, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentId: null,
      }),
    )
  })
})

describe('updateFolder', () => {
  const t = createTestContext()

  it('updates name and regenerates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original',
    })

    const result = await dmAuth.mutation(api.folders.mutations.updateFolder, {
      folderId,
      name: 'Renamed Folder',
    })

    expect(result.folderId).toBe(folderId)
    expect(result.slug).toContain('renamed-folder')

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get("folders", folderId)
      expect(folder!.name).toBe('Renamed Folder')
    })
  })

  it('updates iconName', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.folders.mutations.updateFolder, {
      folderId,
      iconName: 'treasure-chest',
    })

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get("folders", folderId)
      expect(folder!.iconName).toBe('treasure-chest')
    })
  })

  it('updates color', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.folders.mutations.updateFolder, {
      folderId,
      color: '#00ff00',
    })

    await t.run(async (dbCtx) => {
      const folder = await dbCtx.db.get("folders", folderId)
      expect(folder!.color).toBe('#00ff00')
    })
  })

  it('requires FULL_ACCESS permission for player', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.folders.mutations.updateFolder, {
        folderId,
        name: 'Hacked',
      }),
    )
  })

  it('allows player with FULL_ACCESS to update', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.folders.mutations.updateFolder, {
      folderId,
      name: 'Player Updated',
    })
    expect(result.folderId).toBe(folderId)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.folders.mutations.updateFolder, {
        folderId,
        name: 'Nope',
      }),
    )
  })

  it('throws NOT_FOUND for non-existent folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete("folders", folderId)
    })

    await expectNotFound(
      dmAuth.mutation(api.folders.mutations.updateFolder, {
        folderId,
        name: 'Ghost',
      }),
    )
  })

  it('validates name uniqueness on rename', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Alpha',
    })
    const { folderId: secondId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Beta',
    })

    await expectValidationFailed(
      dmAuth.mutation(api.folders.mutations.updateFolder, {
        folderId: secondId,
        name: 'Alpha',
      }),
    )
  })

  it('returns expected shape', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    const result = await dmAuth.mutation(api.folders.mutations.updateFolder, {
      folderId,
      iconName: 'test',
    })

    expect(result).toHaveProperty('folderId')
    expect(result).toHaveProperty('slug')
  })
})

describe('getFolderContentsForDownload', () => {
  const t = createTestContext()

  it('returns folder name and items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Downloads',
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'ReadMe',
    })
    await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'data.csv',
    })

    const result = await dmAuth.query(api.folders.queries.getFolderContentsForDownload, {
      folderId,
    })

    expect(result.folderName).toBe('Downloads')
    expect(result.items.length).toBe(2)
    expect(result.items.every((i) => 'name' in i && 'path' in i && 'type' in i)).toBe(true)
  })

  it('requires VIEW permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.query(api.folders.queries.getFolderContentsForDownload, {
        folderId,
      }),
    )
  })

  it('player with VIEW permission can download folder contents', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Downloads',
      inheritShares: true,
    })
    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
      name: 'Shared Note',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const result = await playerAuth.query(api.folders.queries.getFolderContentsForDownload, {
      folderId,
    })

    expect(result.folderName).toBe('Shared Downloads')
    expect(result.items.length).toBe(1)
    expect(result.items[0].name).toBe('Shared Note.md')
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.query(api.folders.queries.getFolderContentsForDownload, { folderId }),
    )
  })
})

describe('getRootContentsForDownload', () => {
  const t = createTestContext()

  it('returns items at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Root Note',
    })

    const result = await dmAuth.query(api.folders.queries.getRootContentsForDownload, {
      campaignId: ctx.campaignId,
    })

    expect(result.items.some((i) => i.name === 'Root Note.md')).toBe(true)
  })

  it('player gets only items they have VIEW permission on', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Hidden Note',
    })

    const result = await playerAuth.query(api.folders.queries.getRootContentsForDownload, {
      campaignId: ctx.campaignId,
    })

    expect(result.items.some((i) => i.name === 'Hidden Note')).toBe(false)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.query(api.folders.queries.getRootContentsForDownload, {
        campaignId: ctx.campaignId,
      }),
    )
  })
})
