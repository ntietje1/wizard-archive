import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { asDm, asPlayer, setupCampaignContext } from '../../_test/identities.helper'
import { createFolder, createNote, createSidebarShare } from '../../_test/factories.helper'
import { expectNotFound, expectPermissionDenied } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('shareSidebarItem', () => {
  const t = createTestContext()

  it('creates a share for a note', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const shareId = await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    expect(shareId).toBeTruthy()

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(1)
    expect(shares[0].campaignMemberId).toBe(ctx.player.memberId)
  })

  it('creates a share with a specific permission level', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares[0].permissionLevel).toBe('edit')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })

  it('re-activates a soft-deleted share', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(1)
    expect(shares[0].deletionTime).toBeNull()
  })
})

describe('unshareSidebarItem', () => {
  const t = createTestContext()

  it('soft-deletes a share', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
    })

    await dmAuth.mutation(api.sidebarShares.mutations.unshareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      campaignMemberId: ctx.player.memberId,
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(0)
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.unshareSidebarItem, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        campaignMemberId: ctx.player.memberId,
      }),
    )
  })
})

describe('updateSidebarItemSharePermission', () => {
  const t = createTestContext()

  it('updates permission level on an existing share', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.updateSidebarItemSharePermission, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares[0].permissionLevel).toBe('edit')
  })

  it('creates a share if none exists', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.updateSidebarItemSharePermission, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(1)
    expect(shares[0].permissionLevel).toBe('edit')
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.updateSidebarItemSharePermission, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        sidebarItemType: 'note',
        campaignMemberId: ctx.player.memberId,
        permissionLevel: 'edit',
      }),
    )
  })
})

describe('setAllPlayersPermission', () => {
  const t = createTestContext()

  it('sets allPermissionLevel on an item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      permissionLevel: 'view',
    })

    const result = await dmAuth.query(api.sidebarShares.queries.getSidebarItemWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(result.allPermissionLevel).toBe('view')
  })

  it('clears allPermissionLevel with null', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      permissionLevel: null,
    })

    const result = await dmAuth.query(api.sidebarShares.queries.getSidebarItemWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(result.allPermissionLevel).toBeNull()
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
        campaignId: ctx.campaignId,
        sidebarItemId: noteId,
        permissionLevel: 'view',
      }),
    )
  })
})

describe('setFolderInheritShares', () => {
  const t = createTestContext()

  it('enables inheritShares on a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      campaignId: ctx.campaignId,
      folderId,
      inheritShares: true,
    })

    const result = await dmAuth.query(api.sidebarShares.queries.getSidebarItemWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
    })
    expect(result.inheritShares).toBe(true)
  })

  it('disables inheritShares on a folder', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      inheritShares: true,
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      campaignId: ctx.campaignId,
      folderId,
      inheritShares: false,
    })

    const result = await dmAuth.query(api.sidebarShares.queries.getSidebarItemWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
    })
    expect(result.inheritShares).toBe(false)
  })

  it('requires DM role', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id)

    await expectPermissionDenied(
      playerAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
        campaignId: ctx.campaignId,
        folderId,
        inheritShares: true,
      }),
    )
  })
})

describe('getSidebarItemShares', () => {
  const t = createTestContext()

  it('returns active shares for an item', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(1)
    expect(shares[0].campaignMemberId).toBe(ctx.player.memberId)
  })

  it('excludes soft-deleted shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    const shares = await dmAuth.query(api.sidebarShares.queries.getSidebarItemShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })
    expect(shares).toHaveLength(0)
  })
})

describe('getSidebarItemWithShares', () => {
  const t = createTestContext()

  it('returns share info including allPermissionLevel and shares', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const result = await dmAuth.query(api.sidebarShares.queries.getSidebarItemWithShares, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
    })

    expect(result.allPermissionLevel).toBe('view')
    expect(result.shares).toHaveLength(1)
    expect(result.shares[0].permissionLevel).toBe('edit')
  })
})

describe('permission resolution', () => {
  const t = createTestContext()

  it('gives DM full_access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    const item = await dmAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('full_access')
  })

  it('gives player with direct view share VIEW permission', async () => {
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

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('view')
  })

  it('gives player with direct edit share EDIT permission', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('edit')
  })

  it('denies player with no share and no allPermissionLevel', async () => {
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

  it('gives player VIEW via allPermissionLevel', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('view')
  })

  it('individual share overrides allPermissionLevel', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      allPermissionLevel: 'view',
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('edit')
  })

  it('ignores soft-deleted share', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
      deletionTime: Date.now(),
      deletedBy: ctx.dm.profile._id,
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: ctx.campaignId,
        id: noteId,
      }),
    )
  })

  it('inherits permissions from parent folder with inheritShares', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      inheritShares: true,
      allPermissionLevel: 'view',
    })
    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('view')
  })

  it('does not inherit when parent folder has inheritShares disabled', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      inheritShares: false,
      allPermissionLevel: 'view',
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
  })

  it('inherits individual share from parent folder', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)
    const { folderId } = await createFolder(t, ctx.campaignId, ctx.dm.profile._id, {
      inheritShares: true,
    })

    await createSidebarShare(t, ctx.dm.profile._id, {
      campaignId: ctx.campaignId,
      sidebarItemId: folderId,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id, {
      parentId: folderId,
    })

    const item = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: noteId,
    })
    expect(item.myPermissionLevel).toBe('edit')
  })
})
