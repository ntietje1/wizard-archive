import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'

export async function loadPendingAssetState(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  state: 'initializing' | 'ready' | 'failed',
) {
  if (state === 'failed') {
    return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  }
  if (state === 'ready') return null
  const intents = await ctx.db
    .query('resourceAssetCopyIntents')
    .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
    .take(501)
  const operations = new Set(intents.map((intent) => intent.operationUuid))
  const operationId =
    intents.length <= 500 && operations.size === 1 ? intents[0]!.operationUuid : null
  return operationId
    ? { status: 'initializing' as const, operationId }
    : { status: 'integrity_error' as const, issue: 'version_mismatch' as const }
}
