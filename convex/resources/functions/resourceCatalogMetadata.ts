import type { SourcePathAlias } from '@wizard-archive/editor/resources/catalog-contract'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { assertSourcePathAlias } from '@wizard-archive/editor/resources/source-path-alias'
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
  return resource
}

function sourcePathAliasFromRow(row: Doc<'resourceSourcePathAliases'>): SourcePathAlias {
  const alias = {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, row.campaignUuid),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, row.resourceUuid),
    importJobId: assertDomainId(DOMAIN_ID_KIND.importJob, row.importJobUuid),
    sourceRootId: row.sourceRootId,
    rawPath: row.rawPath,
    normalizedPath: row.normalizedPath,
  }
  assertSourcePathAlias(alias)
  return alias
}

export async function appendResourceSourcePathAlias(
  ctx: MutationCtx,
  alias: SourcePathAlias,
): Promise<SourcePathAlias> {
  assertSourcePathAlias(alias)
  await requireOwnedResource(ctx, alias.campaignId, alias.resourceId)
  const existing = await findResourceSourcePathAlias(ctx, alias)
  if (existing) return existing

  await ctx.db.insert('resourceSourcePathAliases', {
    campaignUuid: alias.campaignId,
    resourceUuid: alias.resourceId,
    importJobUuid: alias.importJobId,
    sourceRootId: alias.sourceRootId,
    rawPath: alias.rawPath,
    normalizedPath: alias.normalizedPath,
  })
  return alias
}

export async function findResourceSourcePathAlias(
  ctx: MutationCtx,
  alias: SourcePathAlias,
): Promise<SourcePathAlias | null> {
  assertSourcePathAlias(alias)
  const row = await ctx.db
    .query('resourceSourcePathAliases')
    .withIndex('by_import_entry', (query) =>
      query
        .eq('campaignUuid', alias.campaignId)
        .eq('resourceUuid', alias.resourceId)
        .eq('importJobUuid', alias.importJobId)
        .eq('sourceRootId', alias.sourceRootId)
        .eq('normalizedPath', alias.normalizedPath),
    )
    .unique()
  return row ? sourcePathAliasFromRow(row) : null
}
