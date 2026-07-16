import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignMutationCtx } from '../../functions'
import { findCanonicalResource } from './findCanonicalResource'

export type ContentResourceValidation =
  | Readonly<{ status: 'valid'; resourceId: ResourceId }>
  | Readonly<{
      status: 'rejected'
      reason: 'invalid_uuid' | 'resource_missing' | 'ownership_mismatch' | 'wrong_kind'
    }>

export async function validateContentResource(
  ctx: CampaignMutationCtx,
  value: string,
  expectedKind: 'canvas' | 'note',
): Promise<ContentResourceValidation> {
  let resourceId: ResourceId
  try {
    resourceId = assertDomainId(DOMAIN_ID_KIND.resource, value)
  } catch {
    return { status: 'rejected', reason: 'invalid_uuid' }
  }
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource) return { status: 'rejected', reason: 'resource_missing' }
  if (resource.campaignUuid !== ctx.resourceScope.campaignId) {
    return { status: 'rejected', reason: 'ownership_mismatch' }
  }
  return resource.kind === expectedKind
    ? { status: 'valid', resourceId }
    : { status: 'rejected', reason: 'wrong_kind' }
}
