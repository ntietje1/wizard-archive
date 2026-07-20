import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { MutationCtx } from '../../_generated/server'
import { CAMPAIGN_DELETION_BATCH_SIZE } from '../../campaigns/constants'
import { queueAssetRetirements } from './assetContent'
import { findCanonicalResource } from './findCanonicalResource'

type ItemHistoryCleanupCtx = Pick<MutationCtx, 'db' | 'scheduler'>

export const ITEM_HISTORY_CLEANUP_STAGES = ['entries', 'checkpoints'] as const
export type ItemHistoryCleanupStage = (typeof ITEM_HISTORY_CLEANUP_STAGES)[number]

export async function deleteItemHistoryCaptureIntents(
  ctx: Pick<MutationCtx, 'db'>,
  resourceIds: ReadonlyArray<ResourceId>,
): Promise<void> {
  const intents = await Promise.all(
    resourceIds.map((resourceId) =>
      ctx.db
        .query('itemHistoryCaptureIntents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique(),
    ),
  )
  await Promise.all(intents.flatMap((intent) => (intent ? [ctx.db.delete(intent._id)] : [])))
}

export async function deleteResourceItemHistoryBatch(
  ctx: ItemHistoryCleanupCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
  stage: ItemHistoryCleanupStage,
): Promise<ItemHistoryCleanupStage | null> {
  if (await findCanonicalResource(ctx.db, resourceId)) return null
  if (stage === 'entries') {
    return (await deleteEntriesBatch(ctx, campaignId, resourceId)) ? 'entries' : 'checkpoints'
  }
  return (await deleteNextCheckpoint(ctx, campaignId, resourceId)) ? 'checkpoints' : null
}

export async function deleteCampaignItemHistoryEntriesBatch(
  ctx: Pick<MutationCtx, 'db'>,
  campaignId: CampaignId,
): Promise<boolean> {
  return await deleteEntriesBatch(ctx, campaignId)
}

export async function deleteCampaignItemHistoryCheckpointBatch(
  ctx: ItemHistoryCleanupCtx,
  campaignId: CampaignId,
): Promise<boolean> {
  return await deleteNextCheckpoint(ctx, campaignId)
}

async function deleteEntriesBatch(
  ctx: Pick<MutationCtx, 'db'>,
  campaignId: CampaignId,
  resourceId?: ResourceId,
): Promise<boolean> {
  const entries = await ctx.db
    .query('itemHistoryEntries')
    .withIndex('by_resource_history', (query) => {
      const campaign = query.eq('campaignUuid', campaignId)
      return resourceId ? campaign.eq('resourceUuid', resourceId) : campaign
    })
    .take(CAMPAIGN_DELETION_BATCH_SIZE)
  await Promise.all(entries.map((entry) => ctx.db.delete(entry._id)))
  return entries.length === CAMPAIGN_DELETION_BATCH_SIZE
}

async function deleteNextCheckpoint(
  ctx: ItemHistoryCleanupCtx,
  campaignId: CampaignId,
  resourceId?: ResourceId,
): Promise<boolean> {
  const checkpoint = await ctx.db
    .query('itemHistoryCheckpoints')
    .withIndex('by_resource_snapshot', (query) => {
      const campaign = query.eq('campaignUuid', campaignId)
      return resourceId ? campaign.eq('resourceUuid', resourceId) : campaign
    })
    .first()
  if (!checkpoint) return false

  const assets = await ctx.db
    .query('itemHistoryCheckpointAssets')
    .withIndex('by_snapshot', (query) => query.eq('snapshotUuid', checkpoint.snapshotUuid))
    .take(CAMPAIGN_DELETION_BATCH_SIZE)
  await Promise.all(assets.map((asset) => ctx.db.delete(asset._id)))
  await queueAssetRetirements(
    ctx,
    new Set(assets.map((asset) => assertDomainId(DOMAIN_ID_KIND.asset, asset.assetUuid))),
  )
  if (assets.length < CAMPAIGN_DELETION_BATCH_SIZE) {
    await ctx.db.delete(checkpoint._id)
  }
  return true
}
