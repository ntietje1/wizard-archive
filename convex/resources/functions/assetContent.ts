import {
  DOMAIN_ID_KIND,
  assertDomainId,
  generateDomainId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  AssetId,
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { internal } from '../../_generated/api'

type AssetRetirementCtx = Pick<CampaignMutationCtx, 'db' | 'scheduler'>

export type PreparedAssetCopies = Readonly<{
  initializing: boolean
  remap(sourceAssetUuid: string | null): AssetId | null
  commit(): Promise<void>
}>

export async function prepareAssetCopies(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  resourceId: ResourceId,
  sourceAssetUuids: ReadonlyArray<string | null>,
): Promise<PreparedAssetCopies | null> {
  let sourceAssetIds: Array<AssetId>
  try {
    sourceAssetIds = [...new Set(sourceAssetUuids.filter((value) => value !== null))].map((value) =>
      assertDomainId(DOMAIN_ID_KIND.asset, value),
    )
  } catch {
    return null
  }
  const sources = await Promise.all(
    sourceAssetIds.map((assetId) =>
      ctx.db
        .query('fileStorage')
        .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
        .unique(),
    ),
  )
  if (sources.some((source) => source?.status !== 'committed' || source.storageId === null)) {
    return null
  }

  const assetMap = new Map(
    sourceAssetIds.map((sourceId) => [sourceId, generateDomainId(DOMAIN_ID_KIND.asset)]),
  )
  return {
    initializing: assetMap.size > 0,
    remap: (sourceAssetUuid) => {
      if (sourceAssetUuid === null) return null
      return assetMap.get(assertDomainId(DOMAIN_ID_KIND.asset, sourceAssetUuid))!
    },
    commit: async () => {
      const createdAt = Date.now()
      await Promise.all(
        [...assetMap.values()].map((assetUuid) =>
          ctx.db.insert('resourceAssetOwners', {
            campaignUuid: campaignId,
            resourceUuid: resourceId,
            assetUuid,
          }),
        ),
      )
      const intentIds = await Promise.all(
        [...assetMap].map(([sourceAssetUuid, destinationAssetUuid]) =>
          ctx.db.insert('resourceAssetCopyIntents', {
            campaignUuid: campaignId,
            resourceUuid: resourceId,
            operationUuid: operationId,
            sourceAssetUuid,
            destinationAssetUuid,
            status: 'pending',
            attempts: 0,
            lastAttemptAt: null,
            lastError: null,
            createdAt,
          }),
        ),
      )
      await Promise.all(
        intentIds.map((intentId) =>
          ctx.scheduler.runAfter(0, internal.resources.internalActions.processAssetCopy, {
            intentId,
          }),
        ),
      )
    },
  }
}

export function fileAssetIds(content: { assetUuid: string | null }): Array<AssetId> {
  return content.assetUuid === null ? [] : [assertDomainId(DOMAIN_ID_KIND.asset, content.assetUuid)]
}

export function mapAssetIds(content: {
  imageAssetUuid: string | null
  layers: ReadonlyArray<{ imageAssetUuid: string | null }>
}): Array<AssetId> {
  return [content.imageAssetUuid, ...content.layers.map((layer) => layer.imageAssetUuid)]
    .filter((assetUuid): assetUuid is string => assetUuid !== null)
    .map((assetUuid) => assertDomainId(DOMAIN_ID_KIND.asset, assetUuid))
}

export async function queueAssetRetirements(
  ctx: AssetRetirementCtx,
  retirementAssetUuids: ReadonlySet<AssetId>,
): Promise<void> {
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
