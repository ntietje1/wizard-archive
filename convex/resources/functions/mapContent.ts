import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { initialJsonContentVersion } from './contentVersion'

const EMPTY_MAP_CONTENT = { imageAssetUuid: null, layers: [], pins: [] } as const

export async function createMapContent(
  ctx: CampaignMutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<void> {
  await ctx.db.insert('resourceMapContents', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    imageAssetUuid: null,
    layers: [],
    version: await initialJsonContentVersion(EMPTY_MAP_CONTENT),
  })
}

export async function loadMapContentDeletion(ctx: CampaignMutationCtx, resourceId: ResourceId) {
  const content = await ctx.db
    .query('resourceMapContents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .unique()
  const pins = await ctx.db
    .query('resourceMapPins')
    .withIndex('by_mapResourceUuid', (query) => query.eq('mapResourceUuid', resourceId))
    .take(501)
  return { content, pins }
}
