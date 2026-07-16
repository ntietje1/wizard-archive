import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadPendingAssetState } from './assetContentState'
import { loadFileContentState } from './fileContent'
import { loadMapContentRows } from './mapContent'
import { canvasEncodedBytesWithinWorkload } from '@wizard-archive/editor/canvas/workload'

type ResourceContentKind = 'file' | 'map' | 'canvas'

async function loadFileContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const state = await loadFileContentState(ctx, resourceId)
  if (state.status !== 'ready') return state
  const content = state.content
  return {
    status: 'ready' as const,
    kind: 'file' as const,
    content: {
      attachment: content.assetUuid === null ? ('unattached' as const) : ('attached' as const),
      classification: content.classification,
      byteSize: content.byteSize,
      detectedFormat: content.detectedFormat,
      extension: content.extension,
      mediaType: content.mediaType,
      viewerUnavailableReason: content.viewerUnavailableReason,
    },
    version: content.version,
  }
}

async function loadMapContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const { content, pins } = await loadMapContentRows(ctx.db, resourceId)
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
  const pending = await loadPendingAssetState(ctx, resourceId, content.state)
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
        destination: pin.destination,
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
  if (
    content?.campaignUuid === ctx.resourceScope.campaignId &&
    !canvasEncodedBytesWithinWorkload(content.update)
  ) {
    return { status: 'integrity_error' as const, issue: 'content_limit_exceeded' as const }
  }
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
  const authorization = await authorizeResourceContent(ctx, resourceId, kind)
  if (authorization.status !== 'authorized') return authorization
  switch (kind) {
    case 'file':
      return await loadFileContent(ctx, resourceId)
    case 'map':
      return await loadMapContent(ctx, resourceId)
    case 'canvas':
      return await loadCanvasContent(ctx, resourceId)
  }
}
