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
import { initialFileContentVersion } from '@wizard-archive/editor/resources/content-version'
import { FILE_VIEWER_UNAVAILABLE_REASON } from '@wizard-archive/editor/resources/file-content-contract'
import type { ContentCopyPreparation } from './contentCopyTypes'
import { prepareAssetCopies } from './assetContent'
import { loadPendingAssetState } from './assetContentState'

const EMPTY_FILE_CONTENT = {
  classification: 'inert_file',
  byteSize: 0,
  detectedFormat: null,
  extension: null,
  mediaType: 'application/octet-stream',
  viewerUnavailableReason: FILE_VIEWER_UNAVAILABLE_REASON.empty,
} as const

export async function loadFileContentState(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceFileContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  if (!content) return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  if (content.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
  const pending = await loadPendingAssetState(ctx, resourceId, content.state)
  if (pending) return pending
  return { status: 'ready' as const, content }
}

export async function createFileContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceFileContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    state: 'ready',
    assetUuid: null,
    ...EMPTY_FILE_CONTENT,
    version: await initialFileContentVersion(new Uint8Array(), EMPTY_FILE_CONTENT),
  })
}

export async function loadFileContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resourceFileContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
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
