import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { AssetId, CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { loadCanvasContentDeletion } from './canvasContent'
import { loadFileContentDeletion } from './fileContent'
import { loadMapContentRows } from './mapContent'
import { loadNoteContentDeletion } from './noteContent'
import { fileAssetIds, mapAssetIds } from './assetContent'
import { internal } from '../../_generated/api'
import { literals } from 'convex-helpers/validators'
import { CAMPAIGN_DELETION_BATCH_SIZE } from '../../campaigns/constants'

type ResourceDeletionCtx = Pick<CampaignMutationCtx, 'db' | 'scheduler'>

type ResourceDeletionPlan = {
  bookmarks: Array<Doc<'resourceBookmarks'>>
  aliases: Array<Doc<'resourceSourcePathAliases'>>
  assetsFolders: Array<Doc<'resourceAssetsFolders'>>
  noteContents: Array<Doc<'resourceNoteContents'>>
  noteAwareness: Array<Doc<'resourceNoteAwareness'>>
  fileContents: Array<Doc<'resourceFileContents'>>
  mapContents: Array<Doc<'resourceMapContents'>>
  mapPins: Array<Doc<'resourceMapPins'>>
  canvasContents: Array<Doc<'resourceCanvasContents'>>
  assetCopyIntents: Array<Doc<'resourceAssetCopyIntents'>>
  assetOwners: Array<Doc<'resourceAssetOwners'>>
  retirementAssetUuids: Set<AssetId>
}

function createPlan(): ResourceDeletionPlan {
  return {
    bookmarks: [],
    aliases: [],
    assetsFolders: [],
    noteContents: [],
    noteAwareness: [],
    fileContents: [],
    mapContents: [],
    mapPins: [],
    canvasContents: [],
    assetCopyIntents: [],
    assetOwners: [],
    retirementAssetUuids: new Set(),
  }
}

function rowCount(plan: ResourceDeletionPlan): number {
  return rowGroups(plan).reduce((count, rows) => count + rows.length, 0)
}

function rowGroups(plan: ResourceDeletionPlan) {
  return [
    plan.bookmarks,
    plan.aliases,
    plan.assetsFolders,
    plan.noteContents,
    plan.noteAwareness,
    plan.fileContents,
    plan.mapContents,
    plan.mapPins,
    plan.canvasContents,
    plan.assetCopyIntents,
    plan.assetOwners,
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
      plan.noteAwareness.push(
        ...(await ctx.db
          .query('resourceNoteAwareness')
          .withIndex('by_resourceUuid_and_clientId', (query) =>
            query.eq('resourceUuid', resourceId),
          )
          .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
      )
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
  const plan = createPlan()
  for (const resource of resources) {
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
    plan.aliases.push(
      // react-doctor-disable-next-line react-doctor/async-await-in-loop
      ...(await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.assetsFolders.push(
      ...(await ctx.db
        .query('resourceAssetsFolders')
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
}

async function queueAssetRetirements(
  ctx: ResourceDeletionCtx,
  retirementAssetUuids: ReadonlySet<AssetId>,
) {
  const createdAt = Date.now()
  const assets = [...retirementAssetUuids]
  const existing = await Promise.all(
    assets.map((assetUuid) =>
      ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetUuid))
        .unique(),
    ),
  )
  const candidateIds = await Promise.all(
    assets.map(
      async (assetUuid, index) =>
        existing[index]?._id ??
        (await ctx.db.insert('resourceAssetRetirementCandidates', {
          assetUuid,
          status: 'pending',
          attempts: 0,
          lastAttemptAt: null,
          lastError: null,
          createdAt,
        })),
    ),
  )
  await Promise.all(
    candidateIds.map((candidateId) =>
      ctx.scheduler.runAfter(0, internal.resources.internalActions.processAssetRetirement, {
        candidateId,
      }),
    ),
  )
}

const CAMPAIGN_RESOURCE_DELETION_STAGES = [
  'resources',
  'bookmarks',
  'bookmarkOperations',
  'tombstones',
  'aliases',
  'assetsFolders',
  'operations',
  'noteContents',
  'noteAwareness',
  'fileContents',
  'mapContents',
  'mapPins',
  'canvasContents',
  'assetCopyIntents',
  'assetOwners',
] as const

export type CampaignResourceDeletionStage = (typeof CAMPAIGN_RESOURCE_DELETION_STAGES)[number]
export const campaignResourceDeletionStageValidator = literals(...CAMPAIGN_RESOURCE_DELETION_STAGES)
export const FIRST_CAMPAIGN_RESOURCE_DELETION_STAGE: CampaignResourceDeletionStage = 'resources'
type CampaignResourceRow =
  | Doc<'resources'>
  | Doc<'resourceBookmarks'>
  | Doc<'resourceBookmarkOperations'>
  | Doc<'resourceTombstones'>
  | Doc<'resourceSourcePathAliases'>
  | Doc<'resourceAssetsFolders'>
  | Doc<'resourceOperations'>
  | Doc<'resourceNoteContents'>
  | Doc<'resourceNoteAwareness'>
  | Doc<'resourceFileContents'>
  | Doc<'resourceMapContents'>
  | Doc<'resourceMapPins'>
  | Doc<'resourceCanvasContents'>
  | Doc<'resourceAssetCopyIntents'>

export async function deleteCampaignResourceBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
  stage: CampaignResourceDeletionStage,
): Promise<CampaignResourceDeletionStage | null> {
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
  const rows = await loadCampaignResourceDeletionBatch(ctx, campaignId, stage)
  await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  if (rows.length === CAMPAIGN_DELETION_BATCH_SIZE) return stage
  const index = CAMPAIGN_RESOURCE_DELETION_STAGES.indexOf(stage)
  return CAMPAIGN_RESOURCE_DELETION_STAGES[index + 1] ?? null
}

async function loadCampaignResourceDeletionBatch(
  ctx: ResourceDeletionCtx,
  campaignId: CampaignId,
  stage: Exclude<CampaignResourceDeletionStage, 'assetOwners'>,
): Promise<Array<CampaignResourceRow>> {
  switch (stage) {
    case 'resources':
      return await ctx.db
        .query('resources')
        .withIndex('by_campaign_and_parent', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'bookmarks':
      return await ctx.db
        .query('resourceBookmarks')
        .withIndex('by_member', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'bookmarkOperations':
      return await ctx.db
        .query('resourceBookmarkOperations')
        .withIndex('by_campaign_and_actor', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'tombstones':
      return await ctx.db
        .query('resourceTombstones')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'aliases':
      return await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
    case 'assetsFolders':
      return await ctx.db
        .query('resourceAssetsFolders')
        .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
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
    case 'noteAwareness':
      return await ctx.db
        .query('resourceNoteAwareness')
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
    case 'assetCopyIntents':
      return await ctx.db
        .query('resourceAssetCopyIntents')
        .withIndex('by_campaignUuid', (query) => query.eq('campaignUuid', campaignId))
        .take(CAMPAIGN_DELETION_BATCH_SIZE)
  }
}
