import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { initialBinaryContentVersion } from './contentVersion'

const EMPTY_YJS_UPDATE = new Uint8Array([0, 0]).buffer as ArrayBuffer

export async function createCanvasContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceCanvasContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    update: EMPTY_YJS_UPDATE,
    version: await initialBinaryContentVersion(EMPTY_YJS_UPDATE),
  })
}

export async function loadCanvasContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  return await ctx.db
    .query('resourceCanvasContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
}
