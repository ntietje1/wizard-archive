import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'

type CampaignLifecycleCtx = Pick<MutationCtx, 'db'>

export async function hardDeleteCampaign(
  ctx: CampaignLifecycleCtx,
  campaignId: Id<'campaigns'>,
): Promise<void> {
  const [
    allItems,
    sessions,
    campaignMembers,
    editors,
    editHistory,
    documentSnapshots,
    filesystemTransactions,
  ] = await Promise.all([
    ctx.db
      .query('sidebarItems')
      .withIndex('by_campaign_deletionTime', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('editor')
      .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('editHistory')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('documentSnapshots')
      .withIndex('by_campaign', (q) => q.eq('campaignId', campaignId))
      .collect(),
    ctx.db
      .query('filesystemTransactions')
      .withIndex('by_campaign_actor', (q) => q.eq('campaignId', campaignId))
      .collect(),
  ])

  await Promise.all([
    asyncMap(documentSnapshots, (snapshot) => ctx.db.delete('documentSnapshots', snapshot._id)),
    asyncMap(editHistory, (entry) => ctx.db.delete('editHistory', entry._id)),
    asyncMap(filesystemTransactions, (transaction) =>
      ctx.db.delete('filesystemTransactions', transaction._id),
    ),
    asyncMap(allItems, (item) => ctx.db.delete('sidebarItems', item._id)),
    asyncMap(sessions, (session) => ctx.db.delete('sessions', session._id)),
    asyncMap(campaignMembers, (member) => ctx.db.delete('campaignMembers', member._id)),
    asyncMap(editors, (editor) => ctx.db.delete('editor', editor._id)),
  ])

  await ctx.db.delete('campaigns', campaignId)
}

async function retireCampaignForDeletedDm(
  ctx: CampaignLifecycleCtx,
  { campaign, deletedUserId }: { campaign: Doc<'campaigns'>; deletedUserId: Id<'userProfiles'> },
): Promise<void> {
  if (campaign.status === CAMPAIGN_STATUS.Deleted || campaign.dmUserId !== deletedUserId) return

  await ctx.db.patch('campaigns', campaign._id, {
    status: CAMPAIGN_STATUS.Deleted,
  })
}

export async function removeCampaignMemberForDeletedUser(
  ctx: CampaignLifecycleCtx,
  {
    campaign,
    deletedUserId,
    member,
  }: {
    campaign: Doc<'campaigns'> | null
    deletedUserId: Id<'userProfiles'>
    member: Doc<'campaignMembers'>
  },
): Promise<void> {
  if (member.status === CAMPAIGN_MEMBER_STATUS.Removed) return

  if (campaign) {
    await retireCampaignForDeletedDm(ctx, {
      campaign,
      deletedUserId,
    })
  }

  const [sidebarShares, blockShares] = await Promise.all([
    ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_member', (q) =>
        q.eq('campaignId', member.campaignId).eq('campaignMemberId', member._id),
      )
      .collect(),
    ctx.db
      .query('blockShares')
      .withIndex('by_campaign_member', (q) =>
        q.eq('campaignId', member.campaignId).eq('campaignMemberId', member._id),
      )
      .collect(),
  ])

  await Promise.all([
    asyncMap(sidebarShares, (share) => ctx.db.delete('sidebarItemShares', share._id)),
    asyncMap(blockShares, (share) => ctx.db.delete('blockShares', share._id)),
  ])
  await ctx.db.patch('campaignMembers', member._id, {
    status: CAMPAIGN_MEMBER_STATUS.Removed,
  })
}
