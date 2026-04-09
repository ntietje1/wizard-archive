import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
import { setupFolderTree } from '../../_test/factories.helper'
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

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
    expect(leafItem.myPermissionLevel).toBe('view')
  })

  it('disabling inheritShares on the shared folder stops propagation to descendants', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [true, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const leafBefore = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
    expect(leafBefore.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      folderId: folders[0],
      inheritShares: false,
    })

    await expectNotFound(playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf }))
  })

  it('re-enabling inheritance on the shared folder restores access', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [false, true, true],
    })

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await expectNotFound(playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf }))

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      folderId: folders[0],
      inheritShares: true,
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
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

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: folders[1],
      permissionLevel: 'edit',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
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

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: leaf,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const leafItem = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
    expect(leafItem.myPermissionLevel).toBe('edit')
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

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folders[0],
      sidebarItemType: 'folder',
      campaignMemberId: p1.memberId,
      permissionLevel: 'view',
    })

    const p1Leaf = await p1.authed.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
    expect(p1Leaf.myPermissionLevel).toBe('view')

    await expectNotFound(p2.authed.query(api.sidebarItems.queries.getSidebarItem, { id: leaf }))

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: folders[0],
      permissionLevel: 'view',
    })

    const p2Leaf = await p2.authed.query(api.sidebarItems.queries.getSidebarItem, { id: leaf })
    expect(p2Leaf.myPermissionLevel).toBe('view')
  })
})
