import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourcePermission } from '@wizard-archive/editor/resources/access-policy'
import type { ResourceKind } from '@wizard-archive/editor/resources/resource-record'
import type { CampaignMutationCtx, CampaignQueryCtx } from '../../functions'
import { authorizeResourcePermission } from './resourceAccess'

export async function authorizeResourceContent(
  ctx: CampaignMutationCtx | CampaignQueryCtx,
  resourceId: ResourceId,
  kind: Exclude<ResourceKind, 'folder'>,
  required: Exclude<ResourcePermission, 'none'> = 'view',
) {
  return authorizeResourceContentKinds(ctx, resourceId, [kind], required)
}

export async function authorizeResourceContentKinds(
  ctx: CampaignMutationCtx | CampaignQueryCtx,
  resourceId: ResourceId,
  kinds: ReadonlyArray<Exclude<ResourceKind, 'folder'>>,
  required: Exclude<ResourcePermission, 'none'> = 'view',
) {
  const authorization = await authorizeResourcePermission(ctx, resourceId, required)
  if (authorization.status !== 'authorized') {
    return { status: 'unavailable' as const, reason: 'unauthorized' as const }
  }
  const resource = authorization.resource
  if (resource.kind === 'folder' || !kinds.includes(resource.kind)) {
    return { status: 'unavailable' as const, reason: 'capability_not_supported' as const }
  }
  return { status: 'authorized' as const }
}
