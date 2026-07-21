import type { FolderAccessInheritance } from '@wizard-archive/editor/resources/access-policy'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import { initialResourceMetadataVersion } from '@wizard-archive/editor/resources/resource-metadata-version'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { MutationCtx } from '../../_generated/server'
import { findCanonicalResource } from './findCanonicalResource'
import { resourceRowFromRecord } from './resourceCatalogRow'
import { syncResourceSearchProjection } from './resourceSearchProjection'

export async function createCampaignAssetsFolder(
  ctx: Pick<MutationCtx, 'db'>,
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  inheritance: FolderAccessInheritance,
  resourceId: ResourceId = generateDomainId(DOMAIN_ID_KIND.resource),
): Promise<ResourceId> {
  const now = Date.now()
  const metadata = {
    parentId: null,
    kind: 'folder' as const,
    title: canonicalizeResourceTitle('Assets'),
    icon: 'Box',
    color: null,
    lifecycle: 'active' as const,
  }
  const resource: ResourceRecord = {
    id: resourceId,
    campaignId,
    ...metadata,
    lifecycle: { state: 'active' },
    metadataVersion: await initialResourceMetadataVersion(metadata),
    created: { at: now, by: actorId },
    updated: { at: now, by: actorId },
  }
  await ctx.db.insert('resources', resourceRowFromRecord(resource))
  await ctx.db.insert('resourceAccessPolicies', {
    campaignUuid: campaignId,
    resourceUuid: resourceId,
    audienceAccess: { state: 'default' },
    subject: 'folder',
    inheritance,
  })
  await syncResourceSearchProjection(ctx, resource)
  return resourceId
}

export async function requireCampaignAssetsFolder(
  ctx: Pick<MutationCtx, 'db'>,
  campaignId: CampaignId,
  resourceId: ResourceId,
): Promise<ResourceId> {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (
    !resource ||
    resource.campaignUuid !== campaignId ||
    resource.kind !== 'folder' ||
    resource.lifecycle !== 'active' ||
    resource.parentResourceUuid !== null
  ) {
    throw new TypeError('Campaign Assets folder is missing or corrupt')
  }
  return resourceId
}
