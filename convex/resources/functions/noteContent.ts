import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import type { GenericDatabaseReader } from 'convex/server'
import type { DataModel } from '../../_generated/dataModel'

export async function findNoteContent(
  db: GenericDatabaseReader<DataModel>,
  resourceId: ResourceId,
) {
  return await db
    .query('resourceNoteContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

export async function createNoteContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
  operationId: OperationId,
  now: number,
): Promise<void> {
  await ctx.db.insert('resourceNoteContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    state: 'initializing',
    initializationOperationUuid: operationId,
  })
  await ctx.db.insert('resourceNoteInitializationIntents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    operationUuid: operationId,
    status: 'pending',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    createdAt: now,
  })
}

export async function loadNoteContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const content = await findNoteContent(ctx.db, resourceId)
  const intents = await ctx.db
    .query('resourceNoteInitializationIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .take(2)
  return { content, intents }
}
