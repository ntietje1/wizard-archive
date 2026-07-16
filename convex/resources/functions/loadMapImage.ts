import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignQueryCtx } from '../../functions'
import { authorizeResourceContent } from './authorizeResourceContent'
import { loadMapContentState } from './mapContent'
import { loadCommittedAssetUrl } from './assetContent'

export async function loadMapImage(
  ctx: CampaignQueryCtx,
  resourceId: ResourceId,
  layerId: string | null,
) {
  const authorization = await authorizeResourceContent(ctx, resourceId, 'map')
  if (authorization.status !== 'authorized') return authorization
  const rows = await loadMapContentState(ctx, resourceId)
  if (rows.status !== 'ready') {
    return rows.status === 'initializing' ? { status: 'loading' as const } : rows
  }
  try {
    const image =
      layerId === null
        ? rows.projected.image
        : rows.projected.layers.find((layer) => layer.id === layerId)?.image
    const stored =
      layerId === null
        ? rows.content.image
        : rows.content.layers.find((layer) => layer.id === layerId)?.image
    if (!image || image.status !== 'attached' || !stored) {
      return { status: 'integrity_error' as const, issue: 'content_missing' as const }
    }
    const url = await loadCommittedAssetUrl(
      ctx,
      assertDomainId(DOMAIN_ID_KIND.asset, stored.assetUuid),
    )
    return url
      ? { status: 'ready' as const, image, url, version: rows.content.version }
      : { status: 'integrity_error' as const, issue: 'content_missing' as const }
  } catch {
    return { status: 'integrity_error' as const, issue: 'content_corrupt' as const }
  }
}
