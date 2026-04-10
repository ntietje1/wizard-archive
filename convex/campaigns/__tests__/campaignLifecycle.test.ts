import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { createFile, createFolder, createGameMap, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'

describe('campaign lifecycle', () => {
  const t = createTestContext()

  it('full lifecycle: create, join, accept, content, remove, delete', async () => {
    const dm = await setupUser(t)
    const player = await setupUser(t)

    const campaignId = await dm.authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'Test Campaign',
      slug: 'test-campaign',
    })

    const joinStatus = await player.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug: 'test-campaign',
    })
    expect(joinStatus).toBe('Pending')

    const membersBeforeAccept = await dm.authed.query(api.campaigns.queries.getPlayersByCampaign, {
      campaignId,
    })
    const pendingMember = membersBeforeAccept.find(
      (m) => m.userId === player.profile._id && m.status === 'Pending',
    )
    expect(pendingMember).toBeDefined()

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: pendingMember!._id,
      status: 'Accepted',
    })

    const playerCampaigns = await player.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(playerCampaigns).toHaveLength(1)
    expect(playerCampaigns[0]._id).toBe(campaignId)

    const { folderId } = await createFolder(t, campaignId, dm.profile._id)
    await createNote(t, campaignId, dm.profile._id, { parentId: folderId })
    await createFile(t, campaignId, dm.profile._id)
    await createGameMap(t, campaignId, dm.profile._id)

    const playerSidebarItems = await player.authed.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId, location: 'sidebar' },
    )
    expect(playerSidebarItems.length).toBeGreaterThanOrEqual(4)

    const itemsWithNoAccess = playerSidebarItems.filter((item) => item.myPermissionLevel === 'none')
    expect(itemsWithNoAccess.length).toBe(playerSidebarItems.length)

    await dm.authed.mutation(api.sidebarShares.mutations.setAllPlayersPermission, {
      sidebarItemId: folderId,
      permissionLevel: 'view',
    })

    const playerSidebarAfterShare = await player.authed.query(
      api.sidebarItems.queries.getSidebarItemsByLocation,
      { campaignId, location: 'sidebar' },
    )
    const folderItem = playerSidebarAfterShare.find((item) => item._id === folderId)
    expect(folderItem).toBeDefined()
    expect(folderItem!.myPermissionLevel).toBe('view')

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: pendingMember!._id,
      status: 'Removed',
    })

    const playerCampaignsAfterRemoval = await player.authed.query(
      api.campaigns.queries.getUserCampaigns,
      {},
    )
    expect(playerCampaignsAfterRemoval).toHaveLength(0)

    await dm.authed.mutation(api.campaigns.mutations.deleteCampaign, {
      campaignId,
    })

    const campaign = await t.run(async (ctx) => {
      return await ctx.db.get('campaigns', campaignId)
    })
    expect(campaign).toBeNull()

    const remainingNotes = await t.run(async (ctx) => {
      return await ctx.db
        .query('sidebarItems')
        .withIndex('by_campaign_location_parent_name', (q) => q.eq('campaignId', campaignId))
        .collect()
    })
    expect(remainingNotes).toHaveLength(0)

    const remainingMembers = await t.run(async (ctx) => {
      return await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
        .collect()
    })
    expect(remainingMembers).toHaveLength(0)
  })

  it('multi-player status transitions', async () => {
    const dm = await setupUser(t)
    const p1 = await setupUser(t)
    const p2 = await setupUser(t)
    const p3 = await setupUser(t)

    const campaignId = await dm.authed.mutation(api.campaigns.mutations.createCampaign, {
      name: 'Multi Player Campaign',
      slug: 'multi-player',
    })

    await p1.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug: 'multi-player',
    })
    await p2.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug: 'multi-player',
    })
    await p3.authed.mutation(api.campaigns.mutations.joinCampaign, {
      dmUsername: dm.profile.username,
      slug: 'multi-player',
    })

    const members = await dm.authed.query(api.campaigns.queries.getPlayersByCampaign, {
      campaignId,
    })
    const pendingPlayers = members.filter((m) => m.status === 'Pending')
    expect(pendingPlayers).toHaveLength(3)

    const p1Member = members.find((m) => m.userId === p1.profile._id)
    const p2Member = members.find((m) => m.userId === p2.profile._id)
    const p3Member = members.find((m) => m.userId === p3.profile._id)
    expect(p1Member).toBeDefined()
    expect(p2Member).toBeDefined()
    expect(p3Member).toBeDefined()

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: p1Member!._id,
      status: 'Accepted',
    })
    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: p2Member!._id,
      status: 'Rejected',
    })

    const p1Campaigns = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1Campaigns).toHaveLength(1)

    const p2Campaigns = await p2.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p2Campaigns).toHaveLength(0)

    const p3Campaigns = await p3.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p3Campaigns).toHaveLength(0)

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: p2Member!._id,
      status: 'Accepted',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      memberId: p1Member!._id,
      status: 'Removed',
    })

    const p1CampaignsFinal = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1CampaignsFinal).toHaveLength(0)

    const p2CampaignsFinal = await p2.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p2CampaignsFinal).toHaveLength(1)

    const p3CampaignsFinal = await p3.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p3CampaignsFinal).toHaveLength(0)

    const finalMembers = await dm.authed.query(api.campaigns.queries.getPlayersByCampaign, {
      campaignId,
    })
    const p1Final = finalMembers.find((m) => m.userId === p1.profile._id)
    const p2Final = finalMembers.find((m) => m.userId === p2.profile._id)
    const p3Final = finalMembers.find((m) => m.userId === p3.profile._id)
    expect(p1Final).toBeDefined()
    expect(p2Final).toBeDefined()
    expect(p3Final).toBeDefined()

    expect(p1Final!.status).toBe('Removed')
    expect(p2Final!.status).toBe('Accepted')
    expect(p3Final!.status).toBe('Pending')
  })
})
