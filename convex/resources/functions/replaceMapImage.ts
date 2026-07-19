import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import {
  assertSha256Digest,
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import { advanceMapContentVersion } from '@wizard-archive/editor/resources/map-session-policy'
import type { Infer } from 'convex/values'
import type { CampaignInternalMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { mapContentMutationResultValidator } from '../schema'
import { authorizeResourceContent } from './authorizeResourceContent'
import {
  commitResourceUploadClaim,
  loadResourceAssetOwnership,
  mapAssetIds,
  prepareResourceUploadClaim,
  queueAssetRetirements,
} from './assetContent'
import type { ResourceUploadClaim } from './assetContent'
import { loadValidMapContentRows, projectMapContent } from './mapContent'
import { replaceResourceReferenceProjection } from './resourceReferences'
import { resourceAuthoredDestinationOccurrences } from '@wizard-archive/editor/resources/authored-destination'
import { ITEM_HISTORY_ACTION } from '@wizard-archive/editor/resources/editor-runtime-contract'
import { recordMapHistoryCheckpoint } from './itemHistory'

type MapContentMutationResult = Infer<typeof mapContentMutationResultValidator>
type ValidMapContentRows = Extract<
  Awaited<ReturnType<typeof loadValidMapContentRows>>,
  { status: 'ready' }
>

export type ReplaceMapImageArgs = Readonly<{
  resourceId: string
  expectedVersion: unknown
  layerId: string | null
  uploadSessionId: Id<'fileStorage'>
  image: Readonly<{ byteSize: number; digest: string; mediaType: string }>
}>

type PreparedMapImageReplacement = Readonly<{
  status: 'prepared'
  resourceId: ResourceId
  layerId: string | null
  contentId: Doc<'resourceMapContents'>['_id']
  claim: Extract<ResourceUploadClaim, { status: 'available' }>
  nextImage: Readonly<{ assetUuid: string; byteSize: number; digest: string; mediaType: string }>
  nextContent: Readonly<{
    image: Parameters<typeof projectMapContent>[0]['image']
    layers: Parameters<typeof projectMapContent>[0]['layers']
  }>
  ownership: Exclude<Awaited<ReturnType<typeof loadResourceAssetOwnership>>, 'corrupt'>
  projected: ReturnType<typeof projectMapContent>
  version: ReturnType<typeof assertVersionStamp>
}>

type LoadedMapImageReplacement = Readonly<{
  ready: true
  resourceId: ResourceId
  rows: ValidMapContentRows
  currentImage: ValidMapContentRows['content']['image']
  claim: Exclude<ResourceUploadClaim, { status: 'unavailable' }>
  digest: ReturnType<typeof assertSha256Digest>
}>

export async function replaceMapImage(
  ctx: CampaignInternalMutationCtx,
  args: ReplaceMapImageArgs,
): Promise<MapContentMutationResult> {
  const prepared = await prepareMapImageReplacement(ctx, args)
  if (prepared.status !== 'prepared') return prepared
  return await commitMapImageReplacement(ctx, prepared)
}

async function prepareMapImageReplacement(
  ctx: CampaignInternalMutationCtx,
  args: ReplaceMapImageArgs,
): Promise<PreparedMapImageReplacement | MapContentMutationResult> {
  const loaded = await loadMapImageReplacement(ctx, args)
  if (!loaded.ready) return loaded.result
  const { claim, currentImage, digest, resourceId, rows } = loaded
  if (mapImageReplayMatches(claim, currentImage, args.image, digest)) {
    return { status: 'completed', content: rows.projected, version: rows.content.version }
  }
  if (claim.status === 'claimed') return rejected('invalid_command')
  const currentVersion = assertVersionStamp(rows.content.version)
  if (!versionStampEquals(currentVersion, assertVersionStamp(args.expectedVersion))) {
    return rejected('version_conflict')
  }
  const ownership = await loadResourceAssetOwnership(
    ctx,
    ctx.resourceScope.campaignId,
    resourceId,
    currentImage?.assetUuid ?? null,
  )
  if (ownership === 'corrupt') return rejected('content_corrupt')
  const nextImage = {
    assetUuid: claim.assetId,
    byteSize: args.image.byteSize,
    digest,
    mediaType: args.image.mediaType,
  }
  const nextContent = {
    image: args.layerId === null ? nextImage : rows.content.image,
    layers: rows.content.layers.map((candidate) =>
      candidate.id === args.layerId ? { ...candidate, image: nextImage } : candidate,
    ),
  }
  return await projectMapImageReplacement(
    resourceId,
    args.layerId,
    rows,
    claim,
    nextImage,
    nextContent,
    ownership,
    currentVersion,
  )
}

async function loadMapImageReplacement(
  ctx: CampaignInternalMutationCtx,
  args: ReplaceMapImageArgs,
): Promise<
  LoadedMapImageReplacement | Readonly<{ ready: false; result: MapContentMutationResult }>
> {
  const resourceId = assertDomainId(DOMAIN_ID_KIND.resource, args.resourceId)
  const authorization = await authorizeResourceContent(ctx, resourceId, 'map', 'edit')
  if (authorization.status !== 'authorized') {
    return { ready: false, result: rejected('unauthorized') }
  }
  const rows = await loadValidMapContentRows(ctx.db, resourceId, ctx.resourceScope.campaignId)
  if (rows.status === 'missing') {
    return { ready: false, result: rejected('content_missing') }
  }
  if (rows.status === 'corrupt' || rows.content.state === 'failed') {
    return { ready: false, result: rejected('content_corrupt') }
  }
  if (rows.content.state === 'initializing') {
    return {
      ready: false,
      result: { status: 'retryable', reason: 'content_initializing' },
    }
  }
  const layer =
    args.layerId === null
      ? null
      : rows.content.layers.find((candidate) => candidate.id === args.layerId)
  if (args.layerId !== null && !layer) {
    return { ready: false, result: rejected('layer_missing') }
  }
  const currentImage = args.layerId === null ? rows.content.image : layer!.image
  const digest = assertSha256Digest(args.image.digest)
  const claim = await prepareResourceUploadClaim(ctx, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId,
    sessionId: args.uploadSessionId,
  })
  return claim.status === 'unavailable'
    ? { ready: false, result: rejected('invalid_command') }
    : { ready: true, resourceId, rows, currentImage, claim, digest }
}

async function projectMapImageReplacement(
  resourceId: ResourceId,
  layerId: string | null,
  rows: ValidMapContentRows,
  claim: Extract<ResourceUploadClaim, { status: 'available' }>,
  nextImage: PreparedMapImageReplacement['nextImage'],
  nextContent: PreparedMapImageReplacement['nextContent'],
  ownership: PreparedMapImageReplacement['ownership'],
  currentVersion: ReturnType<typeof assertVersionStamp>,
): Promise<PreparedMapImageReplacement | MapContentMutationResult> {
  try {
    const projected = projectMapContent(nextContent, rows.pins)
    return {
      status: 'prepared',
      resourceId,
      layerId,
      contentId: rows.content._id,
      claim,
      nextImage,
      nextContent,
      ownership,
      projected,
      version: await advanceMapContentVersion(currentVersion, projected),
    }
  } catch (error) {
    return rejected(error instanceof RangeError ? 'version_exhausted' : 'content_corrupt')
  }
}

function mapImageReplayMatches(
  claim: ResourceUploadClaim,
  currentImage: Parameters<typeof projectMapContent>[0]['image'],
  image: ReplaceMapImageArgs['image'],
  digest: string,
): boolean {
  return (
    claim.status === 'claimed' &&
    claim.assetId === currentImage?.assetUuid &&
    currentImage.digest === digest &&
    currentImage.byteSize === image.byteSize &&
    currentImage.mediaType === image.mediaType
  )
}

async function commitMapImageReplacement(
  ctx: CampaignInternalMutationCtx,
  prepared: PreparedMapImageReplacement,
): Promise<MapContentMutationResult> {
  if (
    (
      await replaceResourceReferenceProjection(ctx, {
        campaignId: ctx.resourceScope.campaignId,
        sourceResourceId: prepared.resourceId,
        sourceVersion: prepared.version,
        occurrences: resourceAuthoredDestinationOccurrences(
          prepared.projected.pins.map((pin) => pin.destination),
        ),
      })
    ).status !== 'completed'
  ) {
    return rejected('content_corrupt')
  }
  await commitResourceUploadClaim(ctx, prepared.claim, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId: prepared.resourceId,
    expectedByteSize: prepared.nextImage.byteSize,
  })
  await ctx.db.patch('resourceMapContents', prepared.contentId, {
    image: prepared.nextContent.image,
    layers: prepared.nextContent.layers,
    version: prepared.version,
  })
  await recordMapHistoryCheckpoint(ctx, prepared.resourceId, prepared.version, {
    action: ITEM_HISTORY_ACTION.mapImageChanged,
    metadata: { layerId: prepared.layerId },
  })
  const remainingAssetIds = new Set(mapAssetIds(prepared.nextContent))
  const previousAssetStillReferenced =
    prepared.ownership.previousAssetId !== null &&
    remainingAssetIds.has(prepared.ownership.previousAssetId)
  if (prepared.ownership.previousOwner && !previousAssetStillReferenced) {
    await ctx.db.delete(prepared.ownership.previousOwner._id)
  }
  if (prepared.ownership.previousAssetId && !previousAssetStillReferenced) {
    await queueAssetRetirements(ctx, new Set([prepared.ownership.previousAssetId]))
  }
  return { status: 'completed', content: prepared.projected, version: prepared.version }
}

function rejected(
  reason: Extract<MapContentMutationResult, { status: 'rejected' }>['reason'],
): MapContentMutationResult {
  return { status: 'rejected', reason }
}
