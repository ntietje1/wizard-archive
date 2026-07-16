import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadFileContentState } from './fileContent'
import { loadCommittedAssetUrl } from './assetContent'

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
  const url = await loadCommittedAssetUrl(
    ctx,
    assertDomainId(DOMAIN_ID_KIND.asset, content.assetUuid),
  )
  return url
    ? { status: 'ready' as const, url, version: content.version }
    : { status: 'integrity_error' as const, issue: 'content_missing' as const }
}
