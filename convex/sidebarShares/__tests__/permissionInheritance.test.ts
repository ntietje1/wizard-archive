import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
import { createSidebarShare, setupFolderTree } from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('permission inheritance through nested folder trees', () => {
  const t = createTestContext()

  it('4-level deep chain: share root, leaf inherits through all levels', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 4,
      inheritShares: [true, true, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafItem.myPermissionLevel).toBe('view')
  })

  it('passes inherited permissions through folders even when inheritShares is disabled', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [true, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const leafBefore = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafBefore.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      campaignId: ctx.campaignId,
      folderId: folders[0],
      inheritShares: false,
    })

    const leafAfterDisable = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafAfterDisable.myPermissionLevel).toBe('view')
  })

  it('passes inherited permissions through folders whose inheritShares flag starts false', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [false, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafItem.myPermissionLevel).toBe('view')
  })

  it('allPermissionLevel on intermediate folder overrides inherited share', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [true, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[1]],
      permissionLevel: 'edit',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafItem.myPermissionLevel).toBe('edit')
  })

  it('direct share on leaf beats inherited share from ancestor', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 2,
      inheritShares: [true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: ctx.campaignId,
      sidebarItemIds: [leaf],
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafItem.myPermissionLevel).toBe('edit')
  })

  it('normalizes nullable explicit member shares to view', async () => {
    const ctx = await setupCampaignContext(t)
    const playerAuth = asPlayer(ctx)

    const { leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 1,
      inheritShares: [true],
    })

    await createSidebarShare(t, {
      campaignId: ctx.campaignId,
      sidebarItemId: leaf,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: null,
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: ctx.campaignId,
      id: leaf,
    })
    expect(leafItem.myPermissionLevel).toBe('view')
  })

  it('multiple players with different inheritance paths', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const p1 = players[0]
    const p2 = players[1]

    const { folders, leaf } = await setupFolderTree(t, campaignId, dm.profile._id, {
      depth: 2,
      inheritShares: [true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setSidebarItemsMemberPermission, {
      campaignId: campaignId,
      sidebarItemIds: [folders[0]],
      campaignMemberId: p1.memberId,
      permissionLevel: 'view',
    })

    const p1Leaf = await p1.authed.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: campaignId,
      id: leaf,
    })
    expect(p1Leaf.myPermissionLevel).toBe('view')

    await expectNotFound(
      p2.authed.query(api.sidebarItems.queries.getSidebarItem, {
        campaignId: campaignId,
        id: leaf,
      }),
    )

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermissionForSidebarItems, {
      campaignId: campaignId,
      sidebarItemIds: [folders[0]],
      permissionLevel: 'view',
    })

    const p2Leaf = await p2.authed.query(api.sidebarItems.queries.getSidebarItem, {
      campaignId: campaignId,
      id: leaf,
    })
    expect(p2Leaf.myPermissionLevel).toBe('view')
  })
})
