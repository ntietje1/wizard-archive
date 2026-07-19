import {
  assertVersionStamp,
  versionStampEquals,
} from '@wizard-archive/editor/resources/component-version'
import type { VersionStamp } from '@wizard-archive/editor/resources/component-version'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import { authorizeResourceContentKinds } from './authorizeResourceContent'
import {
  commitResourceUploadClaim,
  loadResourceAssetOwnership,
  prepareResourceUploadClaim,
  queueAssetRetirements,
} from './assetContent'

const PREVIEW_CLAIM_DURATION_MS = 60_000
const PREVIEW_RESOURCE_KINDS = ['note', 'file', 'canvas'] as const

type PreviewPublicationRow = Doc<'resourcePreviewPublications'>

export async function loadResourcePreviewPublication(
  ctx: Pick<CampaignQueryCtx, 'db' | 'resourceScope'>,
  resourceId: ResourceId,
) {
  return await ctx.db
    .query('resourcePreviewPublications')
    .withIndex('by_campaignUuid_and_resourceUuid', (query) =>
      query.eq('campaignUuid', ctx.resourceScope.campaignId).eq('resourceUuid', resourceId),
    )
    .unique()
}

export async function claimResourcePreviewGeneration(
  ctx: CampaignMutationCtx,
  resourceId: ResourceId,
) {
  const authorized = await authorizeResourceContentKinds(
    ctx,
    resourceId,
    PREVIEW_RESOURCE_KINDS,
    'edit',
  )
  if (authorized.status !== 'authorized') {
    return {
      status: 'unavailable' as const,
      reason:
        authorized.reason === 'unauthorized' ? ('unauthorized' as const) : ('unsupported' as const),
    }
  }
  const sourceVersion = await loadResourceContentVersion(ctx, resourceId, authorized.resource.kind)
  if (!sourceVersion) {
    return { status: 'unavailable' as const, reason: 'integrity_error' as const }
  }
  const current = await loadResourcePreviewPublication(ctx, resourceId)
  if (
    current?.publication &&
    versionStampEquals(assertVersionStamp(current.publication.sourceVersion), sourceVersion)
  ) {
    return { status: 'unavailable' as const, reason: 'current' as const }
  }
  const now = Date.now()
  if (
    current?.claim &&
    current.claim.expiresAt > now &&
    versionStampEquals(assertVersionStamp(current.claim.sourceVersion), sourceVersion)
  ) {
    return { status: 'unavailable' as const, reason: 'in_progress' as const }
  }
  const claimToken = crypto.randomUUID()
  const next = {
    campaignUuid: ctx.resourceScope.campaignId,
    resourceUuid: resourceId,
    publication: current?.publication ?? null,
    claim: {
      token: claimToken,
      sourceVersion,
      expiresAt: now + PREVIEW_CLAIM_DURATION_MS,
    },
  }
  if (current) await ctx.db.replace('resourcePreviewPublications', current._id, next)
  else await ctx.db.insert('resourcePreviewPublications', next)
  return { status: 'claimed' as const, claimToken }
}

export async function publishResourcePreview(
  ctx: CampaignMutationCtx,
  args: Readonly<{
    resourceId: ResourceId
    claimToken: string
    uploadSessionId: Id<'fileStorage'>
    byteSize: number
  }>,
) {
  const authorized = await authorizeResourceContentKinds(
    ctx,
    args.resourceId,
    PREVIEW_RESOURCE_KINDS,
    'edit',
  )
  if (authorized.status !== 'authorized') {
    return { status: 'rejected' as const, reason: 'unauthorized' as const }
  }
  const sourceVersion = await loadResourceContentVersion(
    ctx,
    args.resourceId,
    authorized.resource.kind,
  )
  if (!sourceVersion) {
    return { status: 'rejected' as const, reason: 'integrity_error' as const }
  }
  const current = await loadResourcePreviewPublication(ctx, args.resourceId)
  if (
    !current ||
    current.claim?.token !== args.claimToken ||
    current.claim.expiresAt < Date.now()
  ) {
    return { status: 'rejected' as const, reason: 'invalid_claim' as const }
  }
  if (!Number.isSafeInteger(args.byteSize) || args.byteSize <= 0) {
    return { status: 'rejected' as const, reason: 'invalid_upload' as const }
  }
  if (!versionStampEquals(assertVersionStamp(current.claim.sourceVersion), sourceVersion)) {
    await clearPreviewClaim(ctx, current)
    return { status: 'stale' as const }
  }
  const upload = await prepareResourceUploadClaim(ctx, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId: args.resourceId,
    sessionId: args.uploadSessionId,
  })
  if (upload.status !== 'available') {
    return { status: 'rejected' as const, reason: 'invalid_upload' as const }
  }
  const previousOwnership = await loadResourceAssetOwnership(
    ctx,
    ctx.resourceScope.campaignId,
    args.resourceId,
    current.publication?.assetUuid ?? null,
  )
  if (previousOwnership === 'corrupt') {
    return { status: 'rejected' as const, reason: 'integrity_error' as const }
  }
  const committed = await commitResourceUploadClaim(ctx, upload, {
    campaignId: ctx.resourceScope.campaignId,
    resourceId: args.resourceId,
    expectedByteSize: args.byteSize,
  })
  if (committed.assetId === null) {
    throw new TypeError('Preview upload is missing its canonical asset identity')
  }
  await ctx.db.replace('resourcePreviewPublications', current._id, {
    campaignUuid: current.campaignUuid,
    resourceUuid: current.resourceUuid,
    publication: {
      assetUuid: committed.assetId,
      sourceVersion,
      publishedAt: Date.now(),
    },
    claim: null,
  })
  if (previousOwnership.previousOwner && previousOwnership.previousAssetId) {
    await ctx.db.delete(previousOwnership.previousOwner._id)
    await queueAssetRetirements(ctx, new Set([previousOwnership.previousAssetId]))
  }
  return { status: 'published' as const }
}

async function clearPreviewClaim(ctx: CampaignMutationCtx, current: PreviewPublicationRow) {
  if (!current.publication) {
    await ctx.db.delete(current._id)
    return
  }
  await ctx.db.replace('resourcePreviewPublications', current._id, {
    campaignUuid: current.campaignUuid,
    resourceUuid: current.resourceUuid,
    publication: current.publication,
    claim: null,
  })
}

async function loadResourceContentVersion(
  ctx: Pick<CampaignQueryCtx, 'db' | 'resourceScope'>,
  resourceId: ResourceId,
  kind: ResourceKind,
): Promise<VersionStamp | null> {
  const content = await loadResourceContent(ctx, resourceId, kind)
  return content?.campaignUuid === ctx.resourceScope.campaignId &&
    (!('state' in content) || content.state === 'ready')
    ? assertVersionStamp(content.version)
    : null
}

async function loadResourceContent(
  ctx: Pick<CampaignQueryCtx, 'db'>,
  resourceId: ResourceId,
  kind: ResourceKind,
) {
  switch (kind) {
    case 'note':
      return await ctx.db
        .query('resourceNoteContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
    case 'file':
      return await ctx.db
        .query('resourceFileContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
    case 'map':
      return await ctx.db
        .query('resourceMapContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
    case 'canvas':
      return await ctx.db
        .query('resourceCanvasContents')
        .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
        .unique()
    case 'folder':
      return null
  }
}

export async function loadResourcePreviewImageUrl(
  ctx: CampaignQueryCtx,
  resource: Readonly<{ id: ResourceId; kind: ResourceKind }>,
  projectedSourceVersion?: VersionStamp,
): Promise<string | null> {
  if (resource.kind === 'map') {
    const content = await ctx.db
      .query('resourceMapContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.id))
      .unique()
    return content?.campaignUuid === ctx.resourceScope.campaignId &&
      content.state === 'ready' &&
      content.image
      ? await loadAssetUrl(ctx, content.image.assetUuid)
      : null
  }
  if (resource.kind === 'file') {
    const content = await ctx.db
      .query('resourceFileContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resource.id))
      .unique()
    if (
      content?.campaignUuid === ctx.resourceScope.campaignId &&
      content.state === 'ready' &&
      content.assetUuid &&
      content.mediaType.startsWith('image/')
    ) {
      return await loadAssetUrl(ctx, content.assetUuid)
    }
  }
  const publication = await loadResourcePreviewPublication(ctx, resource.id)
  if (!publication?.publication) return null
  const currentSourceVersion = await loadResourceContentVersion(ctx, resource.id, resource.kind)
  if (
    !currentSourceVersion ||
    !versionStampEquals(
      assertVersionStamp(publication.publication.sourceVersion),
      currentSourceVersion,
    ) ||
    (projectedSourceVersion !== undefined &&
      !versionStampEquals(projectedSourceVersion, currentSourceVersion))
  ) {
    return null
  }
  return await loadAssetUrl(ctx, publication.publication.assetUuid)
}

async function loadAssetUrl(ctx: CampaignQueryCtx, assetUuid: string): Promise<string | null> {
  const assetId = assertDomainId(DOMAIN_ID_KIND.asset, assetUuid)
  const storage = await ctx.db
    .query('fileStorage')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', assetId))
    .unique()
  return storage?.status === 'committed' && storage.storageId
    ? await ctx.storage.getUrl(storage.storageId)
    : null
}
