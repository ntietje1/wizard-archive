import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import {
  asDm,
  asPlayer,
  setupCampaignContext,
  setupMultiPlayerContext,
} from '../../_test/identities.helper'
import { createNote, setupFolderTree } from '../../_test/factories.helper'
import { expectNotFound } from '../../_test/assertions.helper'
import { api } from '../../_generated/api'

describe('sharing workflows', () => {
  const t = createTestContext()

  it('direct share lifecycle: share, upgrade, unshare', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        id: noteId,
      }),
    )

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const noteAfterShare = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(noteAfterShare.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarShares.mutations.updateSidebarItemSharePermission, {
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'edit',
    })

    const noteAfterUpgrade = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: noteId,
    })
    expect(noteAfterUpgrade.myPermissionLevel).toBe('edit')

    await dmAuth.mutation(api.sidebarShares.mutations.unshareSidebarItem, {
      sidebarItemId: noteId,
      campaignMemberId: ctx.player.memberId,
    })

    await expectNotFound(
      playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
        id: noteId,
      }),
    )
  })

  it('allPermissionLevel makes items visible to all players', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { noteId: note1Id } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    const { noteId: note2Id } = await createNote(t, ctx.campaignId, ctx.dm.profile._id)
    await createNote(t, ctx.campaignId, ctx.dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: note1Id,
      permissionLevel: 'view',
    })

    const itemsAfterFirst = await playerAuth.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId: ctx.campaignId, location: 'sidebar' },
    )
    const visibleAfterFirst = itemsAfterFirst.filter((item) => item.myPermissionLevel !== 'none')
    expect(visibleAfterFirst).toHaveLength(1)
    expect(visibleAfterFirst[0]._id).toBe(note1Id)

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: note2Id,
      permissionLevel: 'view',
    })

    const itemsAfterSecond = await playerAuth.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId: ctx.campaignId, location: 'sidebar' },
    )
    const visibleAfterSecond = itemsAfterSecond.filter((item) => item.myPermissionLevel !== 'none')
    expect(visibleAfterSecond).toHaveLength(2)
    const visibleIds = visibleAfterSecond.map((item) => item._id)
    expect(visibleIds).toContain(note1Id)
    expect(visibleIds).toContain(note2Id)
  })

  it('folder inheritance chain: share, disable, re-enable, allPermissionLevel override', async () => {
    const ctx = await setupCampaignContext(t)
    const dmAuth = asDm(ctx)
    const playerAuth = asPlayer(ctx)

    const { folders, leaf } = await setupFolderTree(t, ctx.campaignId, ctx.dm.profile._id, {
      depth: 3,
      inheritShares: [true, true, false],
      leafType: 'note',
    })
    const [folderA, folderB] = folders

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: folderA,
      sidebarItemType: 'folder',
      campaignMemberId: ctx.player.memberId,
      permissionLevel: 'view',
    })

    const noteWithInheritance = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: leaf,
    })
    expect(noteWithInheritance.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      folderId: folderA,
      inheritShares: false,
    })

    await expectNotFound(playerAuth.query(api.sidebarItems.queries.getSidebarItem, { id: leaf }))

    await dmAuth.mutation(api.sidebarShares.mutations.setFolderInheritShares, {
      folderId: folderA,
      inheritShares: true,
    })

    const noteAfterReEnable = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: leaf,
    })
    expect(noteAfterReEnable.myPermissionLevel).toBe('view')

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: folderB,
      permissionLevel: 'edit',
    })

    const noteAfterFolderBEdit = await playerAuth.query(api.sidebarItems.queries.getSidebarItem, {
      id: leaf,
    })
    expect(noteAfterFolderBEdit.myPermissionLevel).toBe('edit')
  })

  it('individual share override beats allPermissionLevel', async () => {
    const { dm, players, campaignId } = await setupMultiPlayerContext(t, 2)
    const dmAuth = dm.authed
    const p1 = players[0]
    const p2 = players[1]

    const { noteId } = await createNote(t, campaignId, dm.profile._id)

    await dmAuth.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: noteId,
      permissionLevel: 'view',
    })

    await dmAuth.mutation(api.sidebarShares.mutations.shareSidebarItem, {
      sidebarItemId: noteId,
      sidebarItemType: 'note',
      campaignMemberId: p1.memberId,
      permissionLevel: 'edit',
    })

    const noteAsP1 = await p1.authed.query(api.sidebarItems.queries.getSidebarItem, { id: noteId })
    expect(noteAsP1.myPermissionLevel).toBe('edit')

    const noteAsP2 = await p2.authed.query(api.sidebarItems.queries.getSidebarItem, { id: noteId })
    expect(noteAsP2.myPermissionLevel).toBe('view')
  })
})
