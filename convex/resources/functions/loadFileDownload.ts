import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadFileContentState } from './fileContent'

export async function loadFileDownload(ctx: CampaignQueryCtx, resourceId: ResourceId) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'file')
  if (authorization.status !== 'authorized') return authorization
  const state = await loadFileContentState(ctx, resourceId)
  if (state.status === 'initializing') return { status: 'loading' as const }
  if (state.status !== 'ready') return state
  const content = state.content
  if (content.assetUuid === null) {
    return content.byteSize === 0
      ? { status: 'ready' as const, url: null, version: content.version }
      : { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
  const storage = await ctx.db
    .query('fileStorage')
    .withIndex('by_assetUuid', (query) => query.eq('assetUuid', content.assetUuid))
    .unique()
  if (!storage || storage.status !== 'committed') {
    return { status: 'integrity_error' as const, issue: 'content_missing' as const }
  }
  const url = await ctx.storage.getUrl(storage.storageId)
  return url
    ? { status: 'ready' as const, url, version: content.version }
    : { status: 'integrity_error' as const, issue: 'content_missing' as const }
}
