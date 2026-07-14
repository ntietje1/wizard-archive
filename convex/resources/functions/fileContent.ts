import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { initialJsonContentVersion } from './contentVersion'

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
