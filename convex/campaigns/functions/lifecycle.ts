import { asyncMap } from 'convex-helpers'
import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { deleteCampaignResources } from '../../resources/functions/resourceDeletion'

type CampaignLifecycleCtx = Pick<MutationCtx, 'db' | 'scheduler'>

export async function hardDeleteCampaign(
  ctx: CampaignLifecycleCtx,
  campaignRowId: Id<'campaigns'>,
  campaignId: CampaignId,
): Promise<void> {
  const [sessions, campaignMembers] = await Promise.all([
    ctx.db
      .query('sessions')
      .withIndex('by_campaign_startedAt', (q) => q.eq('campaignId', campaignRowId))
      .collect(),
    ctx.db
      .query('campaignMembers')
      .withIndex('by_campaign_user', (q) => q.eq('campaignId', campaignRowId))
      .collect(),
  ])

  await deleteCampaignResources(ctx, campaignId)
  await Promise.all([
    asyncMap(sessions, (session) => ctx.db.delete('sessions', session._id)),
    asyncMap(campaignMembers, (member) => ctx.db.delete('campaignMembers', member._id)),
  ])

  await ctx.db.delete('campaigns', campaignRowId)
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

  await ctx.db.patch('campaignMembers', member._id, {
    status: CAMPAIGN_MEMBER_STATUS.Removed,
  })
}
