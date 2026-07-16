import { CAMPAIGN_MEMBER_STATUS, CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { internal } from '../../_generated/api'
import { FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE } from '../../resources/functions/resourceDeletion'

type CampaignLifecycleCtx = Pick<MutationCtx, 'db' | 'scheduler'>

export async function beginCampaignDeletion(
  ctx: CampaignLifecycleCtx,
  campaignRowId: Id<'campaigns'>,
  campaignId: CampaignId,
): Promise<void> {
  await ctx.db.patch('campaigns', campaignRowId, { status: CAMPAIGN_STATUS.Deleted })
  await ctx.scheduler.runAfter(
    0,
    internal.resources.internalMutations.deleteCampaignResourceBatch,
    {
      campaignId,
      stage: FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE,
    },
  )
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
