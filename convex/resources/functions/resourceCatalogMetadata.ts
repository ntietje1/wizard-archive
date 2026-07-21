import type { SourcePathAlias } from '@wizard-archive/editor/resources/catalog-contract'
import { assertSourcePathAlias } from '@wizard-archive/editor/resources/source-path-alias'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { MutationCtx } from '../../_generated/server'
import { findCanonicalResource } from './findCanonicalResource'
import { sourcePathAliasFromRow, sourcePathAliasRowFromAlias } from './resourceCatalogRow'

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

export async function appendResourceSourcePathAlias(
  ctx: MutationCtx,
  alias: SourcePathAlias,
): Promise<SourcePathAlias> {
  assertSourcePathAlias(alias)
  await requireOwnedResource(ctx, alias.campaignId, alias.resourceId)
  const existing = await findResourceSourcePathAlias(ctx, alias)
  if (existing) return existing

  await ctx.db.insert('resourceSourcePathAliases', sourcePathAliasRowFromAlias(alias))
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
