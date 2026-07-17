import { CAMPAIGN_STATUS } from '../../../shared/campaigns/types'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { internal } from '../../_generated/api'
import { FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE } from '../../resources/functions/resourceDeletion'

type CampaignLifecycleCtx = Pick<MutationCtx, 'db' | 'scheduler'>
type CampaignCountCtx = Pick<MutationCtx, 'db'>

export async function adjustAcceptedMemberCount(
  ctx: CampaignCountCtx,
  campaignId: Id<'campaigns'>,
  change: -1 | 1,
): Promise<void> {
  const campaign = await ctx.db.get('campaigns', campaignId)
  if (!campaign) throw new TypeError('Campaign accepted member count owner not found')
  if (campaign.status === CAMPAIGN_STATUS.Deleted) return
  const acceptedMemberCount = campaign.acceptedMemberCount + change
  if (!Number.isSafeInteger(acceptedMemberCount) || acceptedMemberCount < 1) {
    throw new TypeError('Campaign accepted member count invariant violated')
  }
  await ctx.db.patch('campaigns', campaignId, { acceptedMemberCount })
}

export async function beginCampaignDeletion(
  ctx: CampaignLifecycleCtx,
  campaign: Pick<Doc<'campaigns'>, '_id' | 'campaignUuid' | 'status'>,
): Promise<void> {
  if (campaign.status === CAMPAIGN_STATUS.Deleted) return

  await ctx.db.patch('campaigns', campaign._id, {
    status: CAMPAIGN_STATUS.Deleted,
    acceptedMemberCount: 0,
  })
  await ctx.scheduler.runAfter(
    0,
    internal.resources.internalMutations.deleteCampaignResourceBatch,
    {
      campaignId: campaign.campaignUuid,
      stage: FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE,
    },
  )
}
