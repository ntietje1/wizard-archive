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
import type {
  CampaignInternalMutationCtx,
  CampaignMutationCtx,
  CampaignQueryCtx,
} from '../../functions'
import { internal } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import { commitUpload } from '../../storage/functions/commitUpload'
import { getUserUploadSession } from '../../storage/functions/getUserUploadSession'

type AssetRetirementCtx = Pick<CampaignMutationCtx, 'db' | 'scheduler'>

export type ResourceUploadClaim =
  | Readonly<{
      status: 'available'
      assetId: AssetId
      sessionId: Id<'fileStorage'>
    }>
  | Readonly<{
      status: 'claimed'
      assetId: AssetId
      upload: Doc<'fileStorage'>
    }>
  | Readonly<{ status: 'unavailable' }>

export async function prepareResourceUploadClaim(
  ctx: CampaignInternalMutationCtx,
  args: Readonly<{
    campaignId: CampaignId
    resourceId: ResourceId
    sessionId: Id<'fileStorage'>
  }>,
): Promise<ResourceUploadClaim> {
  const upload = await getUserUploadSession(ctx, args.sessionId, ctx.membership.userId)
  if (!upload || upload.assetUuid === null || upload.storageId === null) {
    return { status: 'unavailable' }
  }
  const assetId = assertDomainId(DOMAIN_ID_KIND.asset, upload.assetUuid)
  const owner = await ctx.db
    .query('resourceAssetOwners')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
    .unique()
  if (upload.status === 'uncommitted' && owner === null) {
    return { status: 'available', assetId, sessionId: upload._id }
  }
  if (
    upload.status === 'committed' &&
    owner?.campaignUuid === args.campaignId &&
    owner.resourceUuid === args.resourceId
  ) {
    return { status: 'claimed', assetId, upload }
  }
  return { status: 'unavailable' }
}

export async function commitResourceUploadClaim(
  ctx: CampaignInternalMutationCtx,
  claim: Extract<ResourceUploadClaim, { status: 'available' }>,
  binding: Readonly<{
    campaignId: CampaignId
    resourceId: ResourceId
    expectedByteSize: number
  }>,
) {
  const upload = await commitUpload(ctx, { sessionId: claim.sessionId })
  if (
    upload.assetId === null ||
    upload.assetId !== claim.assetId ||
    upload.metadata.size !== binding.expectedByteSize
  ) {
    throw new TypeError('Uploaded file metadata is inconsistent')
  }
  await ctx.db.insert('resourceAssetOwners', {
    campaignUuid: binding.campaignId,
    resourceUuid: binding.resourceId,
    assetUuid: claim.assetId,
  })
  return upload
}

export async function loadResourceAssetOwnership(
  ctx: Pick<CampaignInternalMutationCtx, 'db'>,
  campaignId: CampaignId,
  resourceId: ResourceId,
  assetUuid: string | null,
): Promise<
  | 'corrupt'
  | Readonly<{
      previousAssetId: AssetId | null
      previousOwner: Doc<'resourceAssetOwners'> | null
    }>
> {
  if (assetUuid === null) return { previousAssetId: null, previousOwner: null }
  const previousAssetId = assertDomainId(DOMAIN_ID_KIND.asset, assetUuid)
  const previousOwner = await ctx.db
    .query('resourceAssetOwners')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', previousAssetId))
    .unique()
  return previousOwner?.campaignUuid === campaignId && previousOwner.resourceUuid === resourceId
    ? { previousAssetId, previousOwner }
    : 'corrupt'
}

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
  image: { assetUuid: string } | null
  layers: ReadonlyArray<{ image: { assetUuid: string } | null }>
}): Array<AssetId> {
  return [
    content.image?.assetUuid ?? null,
    ...content.layers.map((layer) => layer.image?.assetUuid ?? null),
  ]
    .filter((assetUuid): assetUuid is string => assetUuid !== null)
    .map((assetUuid) => assertDomainId(DOMAIN_ID_KIND.asset, assetUuid))
}

export async function loadCommittedAssetUrl(
  ctx: Pick<CampaignQueryCtx, 'db' | 'storage'>,
  assetId: AssetId,
): Promise<string | null> {
  const storage = await ctx.db
    .query('fileStorage')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
    .unique()
  return storage?.status === 'committed' ? await ctx.storage.getUrl(storage.storageId) : null
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
