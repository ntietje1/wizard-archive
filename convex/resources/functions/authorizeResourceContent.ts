import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

export async function authorizeResourceContent(
  ctx: CampaignMutationCtx | CampaignQueryCtx,
  resourceId: ResourceId,
  kind: Exclude<ResourceKind, 'folder'>,
) {
  return authorizeResourceContentKinds(ctx, resourceId, [kind])
}

export async function authorizeResourceContentKinds(
  ctx: CampaignMutationCtx | CampaignQueryCtx,
  resourceId: ResourceId,
  kinds: ReadonlyArray<Exclude<ResourceKind, 'folder'>>,
) {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (
    !resource ||
    resource.campaignUuid !== ctx.resourceScope.campaignId ||
    resource.lifecycle !== 'active'
  ) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  if (ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  if (resource.kind === 'folder' || !kinds.includes(resource.kind)) {
    return { status: 'unavailable' as const, reason: 'capability_not_supported' as const }
  }
  return { status: 'authorized' as const }
}
