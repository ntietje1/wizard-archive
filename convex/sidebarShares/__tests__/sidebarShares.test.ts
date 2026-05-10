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
import type { Id } from '../../_generated/dataModel'

async function getShareInfo(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: Id<'campaigns'>,
  sidebarItemId: Id<'sidebarItems'>,
) {
  const [result] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
    campaignId,
    sidebarItemIds: [sidebarItemId],
  })
  if (!result) {
    throw new Error(`Missing share info for sidebar item ${sidebarItemId}`)
  }
  return result
}

async function shareWithPlayer(
  dmAuth: ReturnType<typeof asDm>,
  campaignId: Id<'campaigns'>,
  sidebarItemIds: Array<Id<'sidebarItems'>>,
  campaignMemberId: Id<'campaignMembers'>,
  permissionLevel: 'view' | 'edit' | 'full_access' | 'none' = 'view',
) {
  await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
    campaignId,
    sidebarItemIds,
    campaignMemberId,
    permissionLevel,
  })
}

describe('setSidebarItemsMemberPermission', () => {
  const t = createTestContext()

  it('creates a share for one item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId], ctx.player.memberId)

    const result = await getShareInfo(dmAuth, ctx.campaignId, noteId)
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].campaignMemberId).toBe(ctx.player.memberId)
    expect(result.shares[0].permissionLevel).toBe('view')
  })

  it('sets permissions for multiple items in one mutation', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId, folderId], ctx.player.memberId, 'edit')

    const [note, folder] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
    })
    expect(note.shares[0].permissionLevel).toBe('edit')
    expect(folder.shares[0].permissionLevel).toBe('edit')
  })

  it('logs permission history for each changed item in a batch', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Note' })
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder',
    })

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId, folderId], ctx.player.memberId, 'edit')

    await t.run(async (dbCtx) => {
      const noteHistory = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', noteId).eq('action', 'permission_changed'),
        )
        .collect()
      const folderHistory = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', folderId).eq('action', 'permission_changed'),
        )
        .collect()

      expect(noteHistory).toHaveLength(1)
      expect(folderHistory).toHaveLength(1)
      expect(noteHistory[0].metadata).toMatchObject({
        memberName: ctx.player.profile.name,
        level: 'edit',
        previousLevel: null,
      })
    })
  })

  it('updates existing shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId], ctx.player.memberId, 'view')
    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId], ctx.player.memberId, 'edit')

    const result = await getShareInfo(dmAuth, ctx.campaignId, noteId)
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].permissionLevel).toBe('edit')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
        campaignId: ctx.campaignId,
        sidebarItemIds: [noteId],
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'view',
      }),
    )
  })

  it('rejects items from another campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const otherCtx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, otherCtx.campaignId, otherCtx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
        campaignId: ctx.campaignId,
        sidebarItemIds: [noteId],
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'view',
      }),
    )
  })
})

describe('clearSidebarItemsMemberPermission', () => {
  const t = createTestContext()

  it('removes shares for one or many items', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId, folderId], ctx.player.memberId)
    await dmAuth.mutation(api.sidebarShares.mutations.clearSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
      campaignMemberId: ctx.player.memberId,
    })

    const [note, folder] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
    })
    expect(note.shares).toHaveLength(0)
    expect(folder.shares).toHaveLength(0)
  })

  it('no-ops missing shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.clearSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId],
      campaignMemberId: ctx.player.memberId,
    })

    const result = await getShareInfo(dmAuth, ctx.campaignId, noteId)
    expect(result.shares).toHaveLength(0)
  })

  it('logs permission history only for cleared existing shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, { name: 'Note' })
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      name: 'Folder',
    })

    await shareWithPlayer(dmAuth, ctx.campaignId, [noteId], ctx.player.memberId, 'view')
    await dmAuth.mutation(api.sidebarShares.mutations.clearSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
      campaignMemberId: ctx.player.memberId,
    })

    await t.run(async (dbCtx) => {
      const noteHistory = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', noteId).eq('action', 'permission_changed'),
        )
        .collect()
      const folderHistory = await dbCtx.db
        .query('editHistory')
        .withIndex('by_item_action', (q) =>
          q.eq('itemId', folderId).eq('action', 'permission_changed'),
        )
        .collect()

      expect(noteHistory.map((entry) => entry.metadata)).toEqual([
        {
          memberName: ctx.player.profile.name,
          level: 'view',
          previousLevel: null,
        },
        {
          memberName: ctx.player.profile.name,
          level: null,
          previousLevel: 'view',
        },
      ])
      expect(folderHistory).toHaveLength(0)
    })
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.clearSidebarItemsMemberPermission, {
        campaignId: ctx.campaignId,
        sidebarItemIds: [noteId],
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })
})

describe('getSidebarItemsWithShares', () => {
  const t = createTestContext()

  it('returns share data, all-player permissions, and folder inherit flags', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
      inheritShares: true,
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const [folder, note] = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folderId, noteId],
    })

    expect(folder.allPermissionLevel).toBe('view')
    expect(folder.inheritShares).toBe(true)
    expect(folder.shares).toHaveLength(1)
    expect(note.inheritedAllPermissionLevel).toBe('view')
    expect(note.memberInheritedPermissions[ctx.player.memberId]).toBe('edit')
  })

  it('rejects share queries for items from another campaign', async () => {
    const ctx = await setupCampaignContext(t)
    const otherCtx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, otherCtx.campaignId, otherCtx.dm.profile._id)

    await expectValidationFailed(
      dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
        campaignId: ctx.campaignId,
        sidebarItemIds: [noteId],
      }),
    )
  })
})

describe('setAllPlayersPermissionForSidebarItems', () => {
  const t = createTestContext()

  it('sets and clears allPermissionLevel for item batches', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
      permissionLevel: 'view',
    })

    let results = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
    })
    expect(results.map((item) => item.allPermissionLevel)).toEqual(['view', 'view'])

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
      permissionLevel: null,
    })

    results = await dmAuth.query(api.sidebarShares.queries.getSidebarItemsWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId, folderId],
    })
    expect(results.map((item) => item.allPermissionLevel)).toEqual([null, null])
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
        campaignId: ctx.campaignId,
        sidebarItemIds: [noteId],
        permissionLevel: 'view',
      }),
    )
  })
})

describe('setFolderInheritShares', () => {
  const t = createTestContext()

  it('updates a folder inheritShares flag', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      campaignId: ctx.campaignId,
      folderId,
      inheritShares: true,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).inheritShares).toBe(true)

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      campaignId: ctx.campaignId,
      folderId,
      inheritShares: false,
    })
    expect((await getShareInfo(dmAuth, ctx.campaignId, folderId)).inheritShares).toBe(false)
  })
})

describe('permission resolution', () => {
  const t = createTestContext()

  it('resolves direct, all-player, and inherited permissions', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      inheritShares: true,
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )

    await shareWithPlayer(dmAuth, ctx.campaignId, [folderId], ctx.player.memberId, 'edit')

    expect(
      (
        await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
          campaignId: ctx.campaignId,
          id: noteId,
        })
      ).myPermissionLevel,
    ).toBe('edit')

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [noteId],
      permissionLevel: 'view',
    })

    expect(
      (
        await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
          campaignId: ctx.campaignId,
          id: noteId,
        })
      ).myPermissionLevel,
    ).toBe('view')
  })
})
