import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { initialJsonContentVersion } from './contentVersion'
import type { ContentCopyPreparation } from './contentCopyTypes'

const EMPTY_FILE_CONTENT = {
  assetUuid: null,
  extension: null,
  mediaType: 'application/octet-stream',
  originalName: null,
} as const

export async function createFileContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceFileContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    ...EMPTY_FILE_CONTENT,
    version: await initialJsonContentVersion(EMPTY_FILE_CONTENT),
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
  sourceResourceId: ResourceId,
  destinationResourceId: ResourceId,
): Promise<ContentCopyPreparation> {
  const content = await loadFileContentDeletion(ctx, sourceResourceId)
  if (!content || content.campaignUuid !== campaignId) return { status: 'integrity_error' }
  if (content.assetUuid !== null) return { status: 'unavailable' }

  const copied = {
    assetUuid: null,
    extension: content.extension,
    mediaType: content.mediaType,
    originalName: content.originalName,
  }
  const version = await initialJsonContentVersion(copied)
  return {
    status: 'ready',
    plan: {
      referenceableTargets: [],
      finalize: () =>
        Promise.resolve(async () => {
          await ctx.db.insert('resourceFileContents', {
            campaignUuid: campaignId,
            resourceUuid: destinationResourceId,
            ...copied,
            version,
          })
        }),
    },
  }
}
