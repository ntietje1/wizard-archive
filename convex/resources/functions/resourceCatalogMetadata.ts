import type {
  ApplicationResourceRole,
  SourcePathAlias,
} from '@wizard-archive/editor/resources/catalog-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { findCanonicalResource } from './findCanonicalResource'

async function requireOwnedResource(
  ctx: MutationCtx,
  campaignId: CampaignId,
  resourceId: ResourceId,
) {
  const resource = await findCanonicalResource(ctx.db, resourceId)
  if (!resource || resource.campaignUuid !== campaignId) {
    throw new TypeError('Resource catalog metadata target is not owned by the campaign')
  }
}

function sourcePathAliasFromRow(row: Doc<'resourceSourcePathAliases'>): SourcePathAlias {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, row.campaignUuid),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid),
    firstSeenImportJobId: assertDomainId(DOMAIN_ID_KIND.importJob, row.firstSeenImportJobUuid),
    sourceRootId: row.sourceRootId,
    value: { rawPath: row.rawPath, normalizedPath: row.normalizedPath },
  }
}

export async function appendResourceSourcePathAlias(
  ctx: MutationCtx,
  alias: SourcePathAlias,
): Promise<SourcePathAlias> {
  await requireOwnedResource(ctx, alias.campaignId, alias.resourceId)
  const existing = await ctx.db
    .query('resourceSourcePathAliases')
    .withIndex('by_campaign_and_resource_and_normalizedPath', (query) =>
      query
        .eq('campaignUuid', alias.campaignId)
        .eq('resourceUuid', alias.resourceId)
        .eq('normalizedPath', alias.value.normalizedPath),
    )
    .unique()
  if (existing) return sourcePathAliasFromRow(existing)

  await ctx.db.insert('resourceSourcePathAliases', {
    campaignUuid: alias.campaignId,
    resourceUuid: alias.resourceId,
    firstSeenImportJobUuid: alias.firstSeenImportJobId,
    sourceRootId: alias.sourceRootId,
    rawPath: alias.value.rawPath,
    normalizedPath: alias.value.normalizedPath,
  })
  return alias
}

export async function setApplicationResourceRole(
  ctx: MutationCtx,
  campaignId: CampaignId,
  role: ApplicationResourceRole,
): Promise<void> {
  await requireOwnedResource(ctx, campaignId, role.resourceId)
  const existing = await ctx.db
    .query('resourceRoles')
    .withIndex('by_campaign_and_role', (query) =>
      query.eq('campaignUuid', campaignId).eq('role', role.role),
    )
    .unique()
  if (existing?.resourceUuid === role.resourceId) return
  if (existing) {
    await ctx.db.patch('resourceRoles', existing._id, { resourceUuid: role.resourceId })
    return
  }
  await ctx.db.insert('resourceRoles', {
    campaignUuid: campaignId,
    role: role.role,
    resourceUuid: role.resourceId,
  })
}

export async function removeApplicationResourceRole(
  ctx: MutationCtx,
  campaignId: CampaignId,
  role: string,
): Promise<void> {
  const existing = await ctx.db
    .query('resourceRoles')
    .withIndex('by_campaign_and_role', (query) =>
      query.eq('campaignUuid', campaignId).eq('role', role),
    )
    .unique()
  if (existing) await ctx.db.delete('resourceRoles', existing._id)
}
