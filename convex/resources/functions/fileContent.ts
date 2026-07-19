import type {
  CampaignId,
  OperationId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import {
  assertVersionStamp,
  initialVersion,
} from '@wizard-archive/editor/resources/component-version'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { prepareAssetCopies } from './assetContent'
import { loadPendingAssetState } from './assetContentState'
import { authorizeResourceContent } from './authorizeResourceContent'

export async function loadFileContent(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'file')
  if (authorization.status !== 'authorized') return authorization
  const state = await loadFileContentState(ctx, resourceId)
  if (state.status !== 'ready') return state
  const content = state.content
  return {
    status: 'ready' as const,
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

export async function loadFileContentState(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const content = await loadFileContentRow(ctx.db, resourceId)
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  if (content.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
  const pending = await loadPendingAssetState(ctx, resourceId, content.state)
  if (pending) return pending
  return { status: 'ready' as const, content }
}

export async function loadFileContentRow(db: CampaignQueryCtx['db'], resourceId: ResourceId) {
  return await db
    .query('resourceFileContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}

export async function loadFileContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await loadFileContentRow(ctx.db, resourceId)
}

export async function prepareFileContentCopy(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  operationId: OperationId,
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const content = await loadFileContentDeletion(ctx, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId) return { status: 'integrity_error' }
  const assets = await prepareAssetCopies(ctx, campaignId, operationId, destinationResourceId, [
    content.assetUuid,
  ])
  if (!assets) return { status: 'integrity_error' }

  const copied = {
    assetUuid: assets.remap(content.assetUuid),
    classification: content.classification,
    byteSize: content.byteSize,
    detectedFormat: content.detectedFormat,
    extension: content.extension,
    mediaType: content.mediaType,
    viewerUnavailableReason: content.viewerUnavailableReason,
  }
  const version = initialVersion(assertVersionStamp(content.version).digest)
  return {
    status: 'ready',
    plan: {
      referenceableTargets: [],
      finalize: () =>
        Promise.resolve(async () => {
          await ctx.db.insert('resourceFileContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            state: assets.initializing ? 'initializing' : 'ready',
            ...copied,
            version,
          })
          await assets.commit()
        }),
    },
  }
}
