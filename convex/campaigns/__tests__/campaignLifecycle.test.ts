import { describe, expect, it } from 'vitest'
import { createTestContext } from '../../_test/setup.helper'
import { setupUser } from '../../_test/identities.helper'
import { createFile, createFolder, createGameMap, createNote } from '../../_test/factories.helper'
import { api } from '../../_generated/api'
import { RESOURCE_STATUS } from '@wizard-archive/editor/resources/items-persistence-contract'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { DOCUMENT_SNAPSHOT_TYPE } from '../../documentSnapshots/types'

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

    const membersBeforeAccept = await dm.authed.query(api.campaigns.queries.getCampaignRequests, {
      campaignId,
    })
    const pendingMember = membersBeforeAccept.find(
      (m) => m.userId === player.profile._id && m.status === 'Pending',
    )
    expect(pendingMember).toBeDefined()

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: pendingMember!.id,
      status: 'Accepted',
    })

    const playerCampaigns = await player.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(playerCampaigns).toHaveLength(1)
    expect(playerCampaigns[0].id).toBe(campaignId)

    const { folderId } = await createFolder(t, campaignId, dm.profile._id)
    await createNote(t, campaignId, dm.profile._id, { parentId: folderId })
    await createFile(t, campaignId, dm.profile._id)
    await createGameMap(t, campaignId, dm.profile._id)

    const { active: playerSidebarItems } = await player.authed.query(
      api.sidebarItems.queries.getSidebarItems,
      { campaignId },
    )
    const expectedActiveItems = await t.run(async (ctx) => {
      return await ctx.db
        .query('sidebarItems')
        .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
          q.eq('campaignId', campaignId).eq('status', RESOURCE_STATUS.active),
        )
        .collect()
    })
    expect(playerSidebarItems.every((item) => item.status === RESOURCE_STATUS.active)).toBe(true)
    expect(playerSidebarItems).toHaveLength(0)
    expect(expectedActiveItems.length).toBeGreaterThanOrEqual(4)

    const lifecycleNote = await createNote(t, campaignId, dm.profile._id)
    await t.run(async (dbCtx) => {
      const dmMember = await dbCtx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (q) =>
          q.eq('campaignId', campaignId).eq('userId', dm.profile._id),
        )
        .unique()
      if (!dmMember) throw new Error('Missing DM member')
      const editHistoryId = await dbCtx.db.insert('editHistory', {
        itemId: lifecycleNote.noteId,
        itemType: 'note',
        campaignId,
        campaignMemberId: dmMember._id,
        action: EDIT_HISTORY_ACTION.content_edited,
        metadata: null,
        hasSnapshot: true,
      })
      await dbCtx.db.insert('documentSnapshots', {
        itemId: lifecycleNote.noteId,
        itemType: 'note',
        editHistoryId,
        campaignId,
        snapshotType: DOCUMENT_SNAPSHOT_TYPE.YjsState,
        data: new ArrayBuffer(0),
      })
    })

    await dm.authed.mutation(
      api.sidebarShares.mutations.setResourceAudiencePermissionForSidebarItems,
      {
        campaignId,
        sidebarItemIds: [folderId],
        permissionLevel: 'view',
      },
    )

    const { active: playerSidebarAfterShare } = await player.authed.query(
      api.sidebarItems.queries.getSidebarItems,
      { campaignId },
    )
    const folderItem = playerSidebarAfterShare.find((item) => item.id === folderId)
    expect(folderItem).toBeDefined()
    expect(folderItem!.myPermissionLevel).toBe('view')

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: pendingMember!.id,
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
        .withIndex('by_campaign_deletionTime', (q) => q.eq('campaignId', campaignId))
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

    const remainingHistory = await t.run(async (ctx) => {
      return await ctx.db
        .query('editHistory')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .collect()
    })
    expect(remainingHistory).toHaveLength(0)

    const remainingSnapshots = await t.run(async (ctx) => {
      return await ctx.db
        .query('documentSnapshots')
        .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
        .collect()
    })
    expect(remainingSnapshots).toHaveLength(0)
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

    const members = await dm.authed.query(api.campaigns.queries.getCampaignRequests, {
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
      campaignId,
      memberId: p1Member!.id,
      status: 'Accepted',
    })
    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p2Member!.id,
      status: 'Rejected',
    })

    const p1Campaigns = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1Campaigns).toHaveLength(1)

    const p2Campaigns = await p2.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p2Campaigns).toHaveLength(0)

    const p3Campaigns = await p3.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p3Campaigns).toHaveLength(0)

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p2Member!.id,
      status: 'Accepted',
    })

    await dm.authed.mutation(api.campaigns.mutations.updateCampaignMemberStatus, {
      campaignId,
      memberId: p1Member!.id,
      status: 'Removed',
    })

    const p1CampaignsFinal = await p1.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p1CampaignsFinal).toHaveLength(0)

    const p2CampaignsFinal = await p2.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p2CampaignsFinal).toHaveLength(1)

    const p3CampaignsFinal = await p3.authed.query(api.campaigns.queries.getUserCampaigns, {})
    expect(p3CampaignsFinal).toHaveLength(0)

    const finalRequests = await dm.authed.query(api.campaigns.queries.getCampaignRequests, {
      campaignId,
    })
    const p1Final = finalRequests.find((m) => m.userId === p1.profile._id)
    const p3Final = finalRequests.find((m) => m.userId === p3.profile._id)
    expect(p1Final).toBeDefined()
    expect(p1Final!.status).toBe('Removed')
    expect(p3Final).toBeDefined()
    expect(p3Final!.status).toBe('Pending')
    expect(finalRequests.find((m) => m.userId === p2.profile._id)).toBeUndefined()

    const finalPlayers = await dm.authed.query(api.campaigns.queries.getMembersByCampaign, {
      campaignId,
    })
    const p2Final = finalPlayers.find((m) => m.userId === p2.profile._id)
    expect(p2Final).toBeDefined()
    expect(p2Final!.status).toBe('Accepted')
  })
})
