import { CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { internal } from '../../_generated/api'
import { FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE } from '../../resources/functions/resourceDeletion'

type CampaignLifecycleCtx = Pick<MutationCtx, 'db' | 'scheduler'>

export async function beginCampaignDeletion(
  ctx: CampaignLifecycleCtx,
  campaign: Pick<Doc<'campaigns'>, '_id' | 'campaignUuid' | 'status'>,
): Promise<void> {
  if (campaign.status === CAMPAIGN_STATUS.Deleted) return

  await ctx.db.patch('campaigns', campaign._id, { status: CAMPAIGN_STATUS.Deleted })
  await ctx.scheduler.runAfter(
    0,
    internal.resources.internalMutations.deleteCampaignResourceBatch,
    {
      campaignId: campaign.campaignUuid,
      stage: FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE,
    },
  )
}
