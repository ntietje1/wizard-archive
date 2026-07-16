import { v } from 'convex/values'
import { literals } from 'convex-helpers/validators'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { internal } from '../_generated/api'
import { internalMutation } from '../_generated/server'
import type { MutationCtx } from '../_generated/server'
import type { DataModel, Doc, Id } from '../_generated/dataModel'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type { TableNamesInDataModel } from 'convex/server'
import { CAMPAIGN_STATUS } from '../../shared/campaigns/types'
import { campaignIdValidator } from './schema'
import { CAMPAIGN_DELETION_BATCH_SIZE } from './constants'

const CAMPAIGN_ROW_DELETION_STAGES = ['sessions', 'members', 'preferences'] as const
const campaignRowDeletionStageValidator = literals(...CAMPAIGN_ROW_DELETION_STAGES)
type CampaignRowDeletionStage = (typeof CAMPAIGN_ROW_DELETION_STAGES)[number]
export const deleteCampaignRows = internalMutation({
  args: {
    campaignId: campaignIdValidator,
    stage: campaignRowDeletionStageValidator,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, args.campaignId)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
      .unique()
    if (!campaign || campaign.status !== CAMPAIGN_STATUS.Deleted) return null

    const hasFullBatch = await deleteCampaignRowBatch(ctx, campaign._id, campaignId, args.stage)
    const stageIndex = CAMPAIGN_ROW_DELETION_STAGES.indexOf(args.stage)
    const nextStage = hasFullBatch
      ? args.stage
      : (CAMPAIGN_ROW_DELETION_STAGES[stageIndex + 1] ?? null)
    if (nextStage) {
      await ctx.scheduler.runAfter(0, internal.campaigns.internalMutations.deleteCampaignRows, {
        campaignId,
        stage: nextStage,
      })
    } else {
      await ctx.db.delete(campaign._id)
    }
    return null
  },
})

async function deleteCampaignRowBatch(
  ctx: MutationCtx,
  campaignRowId: Id<'campaigns'>,
  campaignId: CampaignId,
  stage: CampaignRowDeletionStage,
): Promise<boolean> {
  switch (stage) {
    case 'sessions': {
      const rows = await ctx.db
        .query('sessions')
        .withIndex('by_campaign_startedAt', (query) => query.eq('campaignId', campaignRowId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
      return await deleteRows(ctx, rows)
    }
    case 'members': {
      const rows = await ctx.db
        .query('campaignMembers')
        .withIndex('by_campaign_user', (query) => query.eq('campaignId', campaignRowId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
      return await deleteRows(ctx, rows)
    }
    case 'preferences': {
      const rows = await ctx.db
        .query('workspacePreferences')
        .withIndex('by_campaign_user', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
      return await deleteRows(ctx, rows)
    }
  }
}

async function deleteRows<TableName extends TableNamesInDataModel<DataModel>>(
  ctx: MutationCtx,
  rows: Array<Doc<TableName>>,
): Promise<boolean> {
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  return rows.length === CAMPAIGN_DELETION_BATCH_SIZE
}
