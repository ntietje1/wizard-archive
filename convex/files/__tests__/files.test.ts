import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFile, createSidebarShare } from '../../_test/factories.helper'
import {
  expectNotAuthenticated,
  expectPermissionDenied,
  expectValidationFailed,
} from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('createFile', () => {
  const t = createTestContext()

  it('creates a file with storageId null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.files.mutations.createFile, {
      campaignId: ctx.campaignId,
      name: 'My File',
      parentTarget: { kind: 'direct', parentId: null },
    })

    expect(result.fileId).toBeDefined()
    expect(result.slug).toContain('my-file')

    await t.run(async (dbCtx) => {
      const file = await dbCtx.db.get('sidebarItems', result.fileId)
      expect(file).not.toBeNull()
      expect(file!.name).toBe('My File')
      expect(file!.parentId).toBeNull()
      const ext = await dbCtx.db
        .query('files')
        .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', result.fileId))
        .first()
      expect(ext!.storageId).toBeNull()
    })
  })

  it('DM can create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const result = await dmAuth.mutation(api.files.mutations.createFile, {
      campaignId: ctx.campaignId,
      name: 'Root File',
      parentTarget: { kind: 'direct', parentId: null },
    })
    expect(result.fileId).toBeDefined()
  })

  it('player cannot create at root level', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    await expectPermissionDenied(
      playerAuth.mutation(api.files.mutations.createFile, {
        campaignId: ctx.campaignId,
        name: 'Player File',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('validates name', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    await expectValidationFailed(
      dmAuth.mutation(api.files.mutations.createFile, {
        campaignId: ctx.campaignId,
        name: '',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)

    await expectNotAuthenticated(
      t.mutation(api.files.mutations.createFile, {
        campaignId: ctx.campaignId,
        name: 'Nope',
        parentTarget: { kind: 'direct', parentId: null },
      }),
    )
  })
})

describe('updateFile', () => {
  const t = createTestContext()

  it('updates name and regenerates slug', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Original File',
    })

    const result = await dmAuth.mutation(api.files.mutations.updateFile, {
      campaignId: ctx.campaignId,
      fileId,
      name: 'Renamed File',
    })

    expect(result.fileId).toBe(fileId)
    expect(result.slug).toContain('renamed-file')

    await t.run(async (dbCtx) => {
      const file = await dbCtx.db.get('sidebarItems', fileId)
      expect(file!.name).toBe('Renamed File')
    })
  })

  it('requires FULL_ACCESS permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    await expectPermissionDenied(
      playerAuth.mutation(api.files.mutations.updateFile, {
        campaignId: ctx.campaignId,
        fileId,
        name: 'Hacked',
      }),
    )
  })

  it('allows player with FULL_ACCESS to update', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'full_access',
    })

    const result = await playerAuth.mutation(api.files.mutations.updateFile, {
      campaignId: ctx.campaignId,
      fileId,
      name: 'Player Updated',
    })
    expect(result.fileId).toBe(fileId)
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.mutation(api.files.mutations.updateFile, {
        campaignId: ctx.campaignId,
        fileId,
        name: 'Nope',
      }),
    )
  })
})

describe('getFile', () => {
  const t = createTestContext()

  it('returns file with ancestors', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Test File',
    })

    const result = await dmAuth.query(api.files.queries.getFile, {
      campaignId: ctx.campaignId,
      fileId,
    })

    expect(result).not.toBeNull()
    expect(result!._id).toBe(fileId)
    expect(result!.name).toBe('Test File')
    expect(result!.ancestors).toBeDefined()
    expect(Array.isArray(result!.ancestors)).toBe(true)
  })

  it('returns null for unshared soft-deleted file', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const result = await playerAuth.query(api.files.queries.getFile, {
      campaignId: ctx.campaignId,
      fileId,
    })
    expect(result).toBeNull()
  })

  it('returns file for previously-shared soft-deleted file', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Shared Then Deleted',
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: fileId,
      sidebarItemType: 'file',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await t.run(async (dbCtx) => {
      await dbCtx.db.patch('sidebarItems', fileId, {
        deletionTime: Date.now(),
        deletedBy: ctx.dm.profile._id,
      })
    })

    const result = await playerAuth.query(api.files.queries.getFile, {
      campaignId: ctx.campaignId,
      fileId,
    })
    expect(result).not.toBeNull()
    expect(result!._id).toBe(fileId)
    expect(result!.name).toBe('Shared Then Deleted')
  })

  it('returns null for nonexistent file', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)

    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)
    await t.run(async (dbCtx) => {
      await dbCtx.db.delete('sidebarItems', fileId)
    })

    const result = await dmAuth.query(api.files.queries.getFile, {
      campaignId: ctx.campaignId,
      fileId,
    })
    expect(result).toBeNull()
  })

  it('requires authentication', async () => {
    const ctx = await setupCampaignContext(t)
    const { fileId } = await createFile(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotAuthenticated(
      t.query(api.files.queries.getFile, { campaignId: ctx.campaignId, fileId }),
    )
  })
})
