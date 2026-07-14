import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

type ResourceContentKind = 'file' | 'map' | 'canvas'

async function initializationOperation(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const intents = await ctx.db
    .query('resourceAssetCopyIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .take(501)
  const operations = new Set(intents.map((intent) => intent.operationUuid))
  return intents.length > 500 || operations.size !== 1 ? null : intents[0]!.operationUuid
}

async function pendingAssetState(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  state: 'initializing' | 'ready' | 'failed',
) {
  if (state === 'failed') {
    return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  }
  if (state !== 'initializing') return null
  const operationId = await initializationOperation(ctx, resourceId)
  return operationId
    ? { status: 'initializing' as const, operationId }
    : { status: 'integrity_error' as const, issue: 'version_mismatch' as const }
}

async function loadFileContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceFileContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  if (content.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
  const pending = await pendingAssetState(ctx, resourceId, content.state)
  if (pending) return pending
  return {
    status: 'ready' as const,
    kind: 'file' as const,
    content: {
      assetId: content.assetUuid,
      extension: content.extension,
      mediaType: content.mediaType,
      originalName: content.originalName,
    },
    version: content.version,
  }
}

async function loadMapContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const [content, pins] = await Promise.all([
    ctx.db
      .query('resourceMapContents')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique(),
    ctx.db
      .query('resourceMapPins')
      .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', resourceId))
      .take(501),
  ])
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  if (
    content.campaignUuid !== ctx.resourceScope.campaignId ||
    pins.length > 500 ||
    pins.some(
      (pin) => pin.campaignUuid !== content.campaignUuid || pin.mapResourceUuid !== resourceId,
    )
  ) {
    return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
  const pending = await pendingAssetState(ctx, resourceId, content.state)
  if (pending) return pending
  return {
    status: 'ready' as const,
    kind: 'map' as const,
    content: {
      imageAssetId: content.imageAssetUuid,
      layers: content.layers.map((layer) => ({
        id: layer.id,
        imageAssetId: layer.imageAssetUuid,
        name: layer.name,
      })),
      pins: pins.map((pin) => ({
        id: pin.mapPinUuid,
        targetResourceId: pin.targetResourceUuid,
        layerId: pin.layerId,
        x: pin.x,
        y: pin.y,
        visible: pin.visible,
      })),
    },
    version: content.version,
  }
}

async function loadCanvasContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceCanvasContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  return content?.campaignUuid === ctx.resourceScope.campaignId
    ? {
        status: 'ready' as const,
        kind: 'canvas' as const,
        update: content.update,
        version: content.version,
      }
    : {
        status: 'integrity_error' as const,
        issue: content ? ('content_corrupt' as const) : ('content_missing' as const),
      }
}

export async function loadResourceContent(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  kind: ResourceContentKind,
) {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource || resource.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  if (resource.kind !== kind) {
    return { status: 'unavailable' as const, reason: 'capability_not_supported' as const }
  }
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  switch (kind) {
    case 'file':
      return await loadFileContent(ctx, resourceId)
    case 'map':
      return await loadMapContent(ctx, resourceId)
    case 'canvas':
      return await loadCanvasContent(ctx, resourceId)
  }
}
