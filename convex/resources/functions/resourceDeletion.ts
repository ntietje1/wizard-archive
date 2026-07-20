import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { AssetId, CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { loadCanvasContentDeletion } from './canvasContent'
import { loadFileContentDeletion } from './fileContent'
import { loadMapContentRows } from './mapContent'
import { loadNoteContentDeletion } from './noteContent'
import { fileAssetIds, mapAssetIds, queueAssetRetirements } from './assetContent'
import { literals } from 'convex-helpers/validators'
import { CAMPAIGN_DELETION_BATCH_SIZE } from '../../campaigns/constants'
import {
  deleteCampaignItemHistoryCheckpointBatch,
  deleteCampaignItemHistoryEntriesBatch,
  deleteItemHistoryCaptureIntents,
} from './itemHistoryCleanup'

type ResourceDeletionCtx = Pick<CampaignMutationCtx, 'db' | 'scheduler'>

type ResourceDeletionPlan = {
  bookmarks: Array<Doc<'resourceBookmarks'>>
  accessPolicies: Array<Doc<'resourceAccessPolicies'>>
  memberAccess: Array<Doc<'resourceMemberAccess'>>
  noteBlockAudienceAccess: Array<Doc<'noteBlockAudienceAccess'>>
  noteBlockMemberAccess: Array<Doc<'noteBlockMemberAccess'>>
  noteBlockAccessCleanupIntents: Array<Doc<'noteBlockAccessCleanupIntents'>>
  itemHistoryCaptureIntents: Array<Doc<'itemHistoryCaptureIntents'>>
  aliases: Array<Doc<'resourceSourcePathAliases'>>
  noteContents: Array<Doc<'resourceNoteContents'>>
  fileContents: Array<Doc<'resourceFileContents'>>
  mapContents: Array<Doc<'resourceMapContents'>>
  mapPins: Array<Doc<'resourceMapPins'>>
  canvasContents: Array<Doc<'resourceCanvasContents'>>
  searchDocuments: Array<Doc<'resourceSearchDocuments'>>
  assetCopyIntents: Array<Doc<'resourceAssetCopyIntents'>>
  assetOwners: Array<Doc<'resourceAssetOwners'>>
  referenceEdges: Array<Doc<'resourceReferenceEdges'>>
  retirementAssetUuids: Set<AssetId>
  historyCampaignId: CampaignId
  historyResourceIds: Array<ResourceId>
}

function createPlan(campaignId: CampaignId): ResourceDeletionPlan {
  return {
    bookmarks: [],
    accessPolicies: [],
    memberAccess: [],
    noteBlockAudienceAccess: [],
    noteBlockMemberAccess: [],
    noteBlockAccessCleanupIntents: [],
    itemHistoryCaptureIntents: [],
    aliases: [],
    noteContents: [],
    fileContents: [],
    mapContents: [],
    mapPins: [],
    canvasContents: [],
    searchDocuments: [],
    assetCopyIntents: [],
    assetOwners: [],
    referenceEdges: [],
    retirementAssetUuids: new Set(),
    historyCampaignId: campaignId,
    historyResourceIds: [],
  }
}

function rowCount(plan: ResourceDeletionPlan): number {
  return rowGroups(plan).reduce((count, rows) => count + rows.length, 0)
}

function rowGroups(plan: ResourceDeletionPlan) {
  return [
    plan.bookmarks,
    plan.accessPolicies,
    plan.memberAccess,
    plan.noteBlockAudienceAccess,
    plan.noteBlockMemberAccess,
    plan.noteBlockAccessCleanupIntents,
    plan.itemHistoryCaptureIntents,
    plan.aliases,
    plan.noteContents,
    plan.fileContents,
    plan.mapContents,
    plan.mapPins,
    plan.canvasContents,
    plan.searchDocuments,
    plan.assetCopyIntents,
    plan.assetOwners,
    plan.referenceEdges,
  ]
}

async function addContent(
  ctx: CampaignMutationCtx,
  plan: ResourceDeletionPlan,
  resource: Doc<'resources'>,
): Promise<void> {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid)
  switch (resource.kind) {
    case 'folder':
      return
    case 'note': {
      const content = await loadNoteContentDeletion(ctx, resourceId)
      if (content) plan.noteContents.push(content)
      const [audienceRows, memberRows, cleanupIntent] = await Promise.all([
        ctx.db
          .query('noteBlockAudienceAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', resource.campaignUuid).eq('noteUuid', resourceId),
          )
          .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1),
        ctx.db
          .query('noteBlockMemberAccess')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', resource.campaignUuid).eq('noteUuid', resourceId),
          )
          .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1),
        ctx.db
          .query('noteBlockAccessCleanupIntents')
          .withIndex('by_note', (query) =>
            query.eq('campaignUuid', resource.campaignUuid).eq('noteUuid', resourceId),
          )
          .unique(),
      ])
      plan.noteBlockAudienceAccess.push(...audienceRows)
      plan.noteBlockMemberAccess.push(...memberRows)
      if (cleanupIntent) plan.noteBlockAccessCleanupIntents.push(cleanupIntent)
      return
    }
    case 'file': {
      const content = await loadFileContentDeletion(ctx, resourceId)
      if (content) {
        plan.fileContents.push(content)
        fileAssetIds(content).forEach((assetUuid) => plan.retirementAssetUuids.add(assetUuid))
      }
      return
    }
    case 'map': {
      const deletion = await loadMapContentRows(ctx.db, resourceId)
      if (deletion.content) {
        plan.mapContents.push(deletion.content)
        mapAssetIds(deletion.content).forEach((assetUuid) =>
          plan.retirementAssetUuids.add(assetUuid),
        )
      }
      plan.mapPins.push(...deletion.pins)
      return
    }
    case 'canvas': {
      const content = await loadCanvasContentDeletion(ctx, resourceId)
      if (content) plan.canvasContents.push(content)
    }
  }
}

export async function planResourceDeletion(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resources: ReadonlyArray<Doc<'resources'>>,
): Promise<ResourceDeletionPlan | null> {
  const plan = createPlan(campaignId)
  for (const resource of resources) {
    const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid)
    plan.historyResourceIds.push(resourceId)
    // Each resource is accumulated and checked before the next read to keep the row cap strict.
    plan.bookmarks.push(
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      ...(await ctx.db
        .query('resourceBookmarks')
        .withIndex('by_resource', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    const accessPolicy = await ctx.db
      .query('resourceAccessPolicies')
      .withIndex('by_campaign_and_resource', (query) =>
        query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
      )
      .unique()
    if (accessPolicy) plan.accessPolicies.push(accessPolicy)
    plan.memberAccess.push(
      ...(await ctx.db
        .query('resourceMemberAccess')
        .withIndex('by_resource', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.aliases.push(
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      ...(await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.assetCopyIntents.push(
      ...(await ctx.db
        .query('resourceAssetCopyIntents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.assetOwners.push(
      ...(await ctx.db
        .query('resourceAssetOwners')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.referenceEdges.push(
      ...(await ctx.db
        .query('resourceReferenceEdges')
        .withIndex('by_campaign_and_source', (query) =>
          query.eq('campaignUuid', campaignId).eq('sourceResourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    const searchDocument = await ctx.db
      .query('resourceSearchDocuments')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.resourceUuid))
      .unique()
    if (searchDocument) plan.searchDocuments.push(searchDocument)
    const historyCaptureIntent = await ctx.db
      .query('itemHistoryCaptureIntents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique()
    if (historyCaptureIntent) plan.itemHistoryCaptureIntents.push(historyCaptureIntent)
    await addContent(ctx, plan, resource)
    if (rowCount(plan) > MAX_SYNCHRONOUS_RESOURCE_CLOSURE) return null
  }
  return plan
}

export async function applyResourceDeletion(
  ctx: CampaignMutationCtx,
  plan: ResourceDeletionPlan,
): Promise<void> {
  await Promise.all(rowGroups(plan).flatMap((rows) => rows.map((row) => ctx.db.delete(row._id))))
  await queueAssetRetirements(ctx, plan.retirementAssetUuids)
  if (plan.historyResourceIds.length > 0) {
    await ctx.scheduler.runAfter(
      0,
      internal.resources.internalMutations.deleteResourceItemHistoryBatch,
      {
        campaignId: plan.historyCampaignId,
        resourceIds: plan.historyResourceIds,
        resourceIndex: 0,
        stage: 'entries',
      },
    )
  }
}

const CAMPAIGN_RESOURCE_DELETION_STAGES = [
  'resources',
  'bookmarks',
  'accessPolicies',
  'memberAccess',
  'noteBlockAudienceAccess',
  'noteBlockMemberAccess',
  'noteBlockAccessCleanupIntents',
  'noteBlockAccessOperations',
  'accessOperations',
  'tombstones',
  'transferMetadata',
  'operations',
  'noteContents',
  'fileContents',
  'mapContents',
  'mapPins',
  'canvasContents',
  'searchDocuments',
  'recoveryReapplyOperations',
  'historyRestoreOperations',
  'historyEntries',
  'historyCheckpoints',
  'referenceEdges',
  'assetCopyIntents',
  'assetOwners',
] as const

export type CampaignResourceDeletionStage = (typeof CAMPAIGN_RESOURCE_DELETION_STAGES)[number]
export const campaignResourceDeletionStageValidator = literals(...CAMPAIGN_RESOURCE_DELETION_STAGES)
export const FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE: CampaignResourceDeletionStage = 'resources'
type CampaignResourceRow =
  | Doc<'resources'>
  | Doc<'resourceBookmarks'>
  | Doc<'resourceAccessPolicies'>
  | Doc<'resourceMemberAccess'>
  | Doc<'noteBlockAudienceAccess'>
  | Doc<'noteBlockMemberAccess'>
  | Doc<'noteBlockAccessCleanupIntents'>
  | Doc<'noteBlockAccessOperations'>
  | Doc<'resourceAccessOperations'>
  | Doc<'resourceTombstones'>
  | Doc<'resourceTransferEntries'>
  | Doc<'resourceTransferJobs'>
  | Doc<'resourceSourcePathAliases'>
  | Doc<'resourceOperations'>
  | Doc<'resourceNoteContents'>
  | Doc<'resourceFileContents'>
  | Doc<'resourceMapContents'>
  | Doc<'resourceMapPins'>
  | Doc<'resourceCanvasContents'>
  | Doc<'resourceSearchDocuments'>
  | Doc<'yjsRecoveryReapplyOperations'>
  | Doc<'itemHistoryRestoreOperations'>
  | Doc<'resourceReferenceEdges'>
  | Doc<'resourceAssetCopyIntents'>

export async function deleteCampaignResourceBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
  stage: CampaignResourceDeletionStage,
): Promise<CampaignResourceDeletionStage | null> {
  if (stage === 'resources') {
    const resources = await ctx.db
      .query('resources')
      .withIndex('by_campaign_and_parent', (query) => query.eq('campaignUuid', campaignId))
      .take(CAMPAIGN_DELETION_BATCH_SIZE)
    await deleteItemHistoryCaptureIntents(
      ctx,
      resources.map((resource) => assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid)),
    )
    await Promise.all(resources.map((resource) => ctx.db.delete(resource._id)))
    return resources.length === CAMPAIGN_DELETION_BATCH_SIZE ? stage : 'bookmarks'
  }
  if (stage === 'historyEntries') {
    return (await deleteCampaignItemHistoryEntriesBatch(ctx, campaignId))
      ? stage
      : 'historyCheckpoints'
  }
  if (stage === 'historyCheckpoints') {
    return (await deleteCampaignItemHistoryCheckpointBatch(ctx, campaignId))
      ? stage
      : 'referenceEdges'
  }
  if (stage === 'assetOwners') {
    const owners = await ctx.db
      .query('resourceAssetOwners')
      .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
      .take(CAMPAIGN_DELETION_BATCH_SIZE)
    await queueAssetRetirements(
      ctx,
      new Set(owners.map((owner) => assertDomainId(DOMAIN_ID_KIND.asset, owner.assetUuid))),
    )
    await Promise.all(owners.map((owner) => ctx.db.delete(owner._id)))
    return owners.length === CAMPAIGN_DELETION_BATCH_SIZE ? stage : null
  }
  const rows =
    stage === 'referenceEdges'
      ? await ctx.db
          .query('resourceReferenceEdges')
          .withIndex('by_campaign_and_source', (query) => query.eq('campaignUuid', campaignId))
          .take(CAMPAIGN_DELETION_BATCH_SIZE)
      : await loadCampaignResourceDeletionBatch(ctx, campaignId, stage)
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  if (rows.length === CAMPAIGN_DELETION_BATCH_SIZE) return stage
  const index = CAMPAIGN_RESOURCE_DELETION_STAGES.indexOf(stage)
  return CAMPAIGN_RESOURCE_DELETION_STAGES[index + 1] ?? null
}

async function loadCampaignResourceDeletionBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
  stage: Exclude<
    CampaignResourceDeletionStage,
    'assetOwners' | 'historyCheckpoints' | 'historyEntries' | 'referenceEdges' | 'resources'
  >,
): Promise<Array<CampaignResourceRow>> {
  const accessRows = await loadCampaignAccessDeletionBatch(ctx, campaignId, stage)
  if (accessRows) return accessRows
  switch (stage) {
    case 'bookmarks':
      return await ctx.db
        .query('resourceBookmarks')
        .withIndex('by_member', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'noteBlockAccessOperations':
      return await ctx.db
        .query('noteBlockAccessOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'accessOperations':
      return await ctx.db
        .query('resourceAccessOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'tombstones':
      return await ctx.db
        .query('resourceTombstones')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'transferMetadata':
      return await loadCampaignTransferMetadataDeletionBatch(ctx, campaignId)
    case 'operations':
      return await ctx.db
        .query('resourceOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'noteContents':
      return await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'fileContents':
      return await ctx.db
        .query('resourceFileContents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'mapContents':
      return await ctx.db
        .query('resourceMapContents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'mapPins':
      return await ctx.db
        .query('resourceMapPins')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'canvasContents':
      return await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'searchDocuments':
      return await ctx.db
        .query('resourceSearchDocuments')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'assetCopyIntents':
      return await ctx.db
        .query('resourceAssetCopyIntents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'historyRestoreOperations':
      return await ctx.db
        .query('itemHistoryRestoreOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'recoveryReapplyOperations':
      return await ctx.db
        .query('yjsRecoveryReapplyOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
  }
  throw new TypeError(`Unknown campaign resource deletion stage: ${stage}`)
}

async function loadCampaignAccessDeletionBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
  stage: CampaignResourceDeletionStage,
): Promise<Array<CampaignResourceRow> | null> {
  switch (stage) {
    case 'accessPolicies':
      return await ctx.db
        .query('resourceAccessPolicies')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'memberAccess':
      return await ctx.db
        .query('resourceMemberAccess')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'noteBlockAudienceAccess':
      return await ctx.db
        .query('noteBlockAudienceAccess')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'noteBlockMemberAccess':
      return await ctx.db
        .query('noteBlockMemberAccess')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'noteBlockAccessCleanupIntents':
      return await ctx.db
        .query('noteBlockAccessCleanupIntents')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    default:
      return null
  }
}

async function loadCampaignTransferMetadataDeletionBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
): Promise<Array<CampaignResourceRow>> {
  const entries = await ctx.db
    .query('resourceTransferEntries')
    .withIndex('by_campaign_and_job', (query) => query.eq('campaignUuid', campaignId))
    .take(CAMPAIGN_DELETION_BATCH_SIZE)
  const rows: Array<CampaignResourceRow> = [...entries]
  if (rows.length === CAMPAIGN_DELETION_BATCH_SIZE) return rows
  const jobs = await ctx.db
    .query('resourceTransferJobs')
    .withIndex('by_campaign_and_importJobUuid', (query) => query.eq('campaignUuid', campaignId))
    .take(CAMPAIGN_DELETION_BATCH_SIZE - rows.length)
  rows.push(...jobs)
  if (rows.length === CAMPAIGN_DELETION_BATCH_SIZE) return rows
  const aliases = await ctx.db
    .query('resourceSourcePathAliases')
    .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
    .take(CAMPAIGN_DELETION_BATCH_SIZE - rows.length)
  rows.push(...aliases)
  return rows
}
