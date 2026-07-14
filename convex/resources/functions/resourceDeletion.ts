import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import { MAX_SYNCHRONOUS_RESOURCE_CLOSURE } from '@wizard-archive/editor/resources/resource-record'
import type { Doc } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import { loadCanvasContentDeletion } from './canvasContent'
import { loadFileContentDeletion } from './fileContent'
import { loadMapContentDeletion } from './mapContent'
import { loadNoteContentDeletion } from './noteContent'
import { fileAssetIds, mapAssetIds } from './assetContent'

type ResourceDeletionPlan = {
  aliases: Array<Doc<'resourceSourcePathAliases'>>
  roles: Array<Doc<'resourceRoles'>>
  noteContents: Array<Doc<'resourceNoteContents'>>
  noteIntents: Array<Doc<'resourceNoteInitializationIntents'>>
  fileContents: Array<Doc<'resourceFileContents'>>
  mapContents: Array<Doc<'resourceMapContents'>>
  mapPins: Array<Doc<'resourceMapPins'>>
  canvasContents: Array<Doc<'resourceCanvasContents'>>
  assetCopyIntents: Array<Doc<'resourceAssetCopyIntents'>>
  retirementAssetUuids: Set<string>
}

function createPlan(): ResourceDeletionPlan {
  return {
    aliases: [],
    roles: [],
    noteContents: [],
    noteIntents: [],
    fileContents: [],
    mapContents: [],
    mapPins: [],
    canvasContents: [],
    assetCopyIntents: [],
    retirementAssetUuids: new Set(),
  }
}

function rowCount(plan: ResourceDeletionPlan): number {
  return rowGroups(plan).reduce((count, rows) => count + rows.length, 0)
}

function rowGroups(plan: ResourceDeletionPlan) {
  return [
    plan.aliases,
    plan.roles,
    plan.noteContents,
    plan.noteIntents,
    plan.fileContents,
    plan.mapContents,
    plan.mapPins,
    plan.canvasContents,
    plan.assetCopyIntents,
  ]
}

async function addContent(
  ctx: CampaignMutationCtx,
  plan: ResourceDeletionPlan,
  resource: Doc<'resources'>,
): Promise<void> {
  const resourceId = resource.resourceUuid as ResourceId
  switch (resource.kind) {
    case 'folder':
      return
    case 'note': {
      const deletion = await loadNoteContentDeletion(ctx, resourceId)
      if (deletion.content) plan.noteContents.push(deletion.content)
      plan.noteIntents.push(...deletion.intents)
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
      const deletion = await loadMapContentDeletion(ctx, resourceId)
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
    plan.aliases.push(
      ...(await ctx.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource_and_normalizedPath', (query) =>
          query.eq('campaignUuid', campaignId).eq('resourceUuid', resource.resourceUuid),
        )
        .take(MAX_SYNCHRONOUS_RESOURCE_CLOSURE + 1)),
    )
    plan.roles.push(
      ...(await ctx.db
        .query('resourceRoles')
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
  const createdAt = Date.now()
  const assets = [...plan.retirementAssetUuids]
  const existing = await Promise.all(
    assets.map((assetUuid) =>
      ctx.db
        .query('resourceAssetRetirementCandidates')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetUuid))
        .unique(),
    ),
  )
  await Promise.all(
    assets.flatMap((assetUuid, index) =>
      existing[index]
        ? []
        : [
            ctx.db.insert('resourceAssetRetirementCandidates', {
              assetUuid,
              status: 'pending',
              attempts: 0,
              lastAttemptAt: null,
              lastError: null,
              createdAt,
            }),
          ],
    ),
  )
}
