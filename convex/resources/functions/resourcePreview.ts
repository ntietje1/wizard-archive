import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignQueryCtx } from '../../functions'
import { loadCommittedAssetUrl } from './assetContent'
import { loadFileContentRow } from './fileContent'
import { loadMapContentRow } from './mapContent'

export async function loadAuthoritativeResourcePreviewImageUrl(
  ctx: CampaignQueryCtx,
  resource: Readonly<{ id: ResourceId; kind: ResourceKind }>,
): Promise<string | null> {
  if (resource.kind === 'map') {
    const content = await loadMapContentRow(ctx.db, resource.id)
    return content?.campaignUuid === ctx.resourceScope.campaignId &&
      content.state === 'ready' &&
      content.image
      ? await loadCommittedAssetUrl(
          ctx,
          assertDomainId(DOMAIN_ID_KIND.asset, content.image.assetUuid),
        )
      : null
  }
  if (resource.kind !== 'file') return null
  const content = await loadFileContentRow(ctx.db, resource.id)
  return content?.campaignUuid === ctx.resourceScope.campaignId &&
    content.state === 'ready' &&
    content.assetUuid &&
    content.mediaType.startsWith('image/')
    ? await loadCommittedAssetUrl(ctx, assertDomainId(DOMAIN_ID_KIND.asset, content.assetUuid))
    : null
}
