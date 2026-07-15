import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import { assertSourcePathAlias } from '@wizard-archive/editor/resources/source-path-alias'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceCatalogPage,
  ResourceCatalogReader,
  ResourceCatalogSnapshot,
  SourcePathAlias,
} from '@wizard-archive/editor/resources/catalog-contract'
import { assertResourceCatalogPageSize } from '@wizard-archive/editor/resources/catalog-contract'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTombstone } from '@wizard-archive/editor/resources/resource-metadata-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { resourceRecordFromRow } from './resourceRecordRow'

function toTombstone(tombstone: Doc<'resourceTombstones'>): ResourceTombstone {
  return {
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, tombstone.resourceUuid),
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, tombstone.campaignUuid),
    deletionVersion: assertVersionStamp(tombstone.deletionVersion),
    deletedAt: tombstone.deletedAt,
  }
}

function toAlias(alias: Doc<'resourceSourcePathAliases'>): SourcePathAlias {
  const sourcePathAlias = {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, alias.campaignUuid),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, alias.resourceUuid),
    importJobId: assertDomainId(DOMAIN_ID_KIND.importJob, alias.importJobUuid),
    sourceRootId: alias.sourceRootId,
    rawPath: alias.rawPath,
    normalizedPath: alias.normalizedPath,
  }
  assertSourcePathAlias(sourcePathAlias)
  return sourcePathAlias
}

export class ConvexResourceCatalog implements ResourceCatalogReader {
  constructor(private readonly db: QueryCtx['db']) {}

  async getResource(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ResourceRecord | null> {
    const resource = await this.db
      .query('resources')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique()
    return resource?.campaignUuid === campaignId ? resourceRecordFromRow(resource) : null
  }

  async getResources(
    campaignId: CampaignId,
    resourceIds: ReadonlyArray<ResourceId>,
  ): Promise<ReadonlyArray<ResourceRecord>> {
    const resources = await Promise.all(
      resourceIds.map((resourceId) => this.getResource(campaignId, resourceId)),
    )
    return resources.filter((resource): resource is ResourceRecord => resource !== null)
  }

  async listChildren(
    campaignId: CampaignId,
    parentId: ResourceId | null,
    lifecycle: 'active' | 'trashed',
    limit: number,
    cursor: string | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>> {
    assertResourceCatalogPageSize(limit)
    const after = cursor === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, cursor)
    const query = this.db
      .query('resources')
      .withIndex('by_campaign_and_parent_and_lifecycle_and_resource', (indexQuery) => {
        const scoped = indexQuery
          .eq('campaignUuid', campaignId)
          .eq('parentResourceUuid', parentId)
          .eq('lifecycle', lifecycle)
        return after === null ? scoped : scoped.gt('resourceUuid', after)
      })
    const page = await query.take(limit + 1)
    const items = page.slice(0, limit).map(resourceRecordFromRow)
    return {
      items,
      cursor: page.length > limit ? items[items.length - 1]!.id : null,
    }
  }

  async getTombstone(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ResourceTombstone | null> {
    const tombstone = await this.db
      .query('resourceTombstones')
      .withIndex('by_resourceUuid', (query) => query.eq('resourceUuid', resourceId))
      .unique()
    return tombstone?.campaignUuid === campaignId ? toTombstone(tombstone) : null
  }

  async listAliases(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ReadonlyArray<SourcePathAlias>> {
    const aliases = await this.db
      .query('resourceSourcePathAliases')
      .withIndex('by_campaign_and_resource', (query) =>
        query.eq('campaignUuid', campaignId).eq('resourceUuid', resourceId),
      )
      .collect()
    return aliases.map(toAlias)
  }

  async getAssetsFolder(campaignId: CampaignId): Promise<ResourceId | null> {
    const assignment = await this.db
      .query('resourceAssetsFolders')
      .withIndex('by_campaign', (query) => query.eq('campaignUuid', campaignId))
      .unique()
    return assignment ? assertDomainId(DOMAIN_ID_KIND.resource, assignment.resourceUuid) : null
  }

  async readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    const [resources, tombstones, aliases, assetsFolderId] = await Promise.all([
      this.db
        .query('resources')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .collect(),
      this.db
        .query('resourceTombstones')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .collect(),
      this.db
        .query('resourceSourcePathAliases')
        .withIndex('by_campaign_and_resource', (query) => query.eq('campaignUuid', campaignId))
        .collect(),
      this.getAssetsFolder(campaignId),
    ])
    return {
      campaignId,
      resources: resources.map(resourceRecordFromRow),
      tombstones: tombstones.map(toTombstone),
      aliases: aliases.map(toAlias),
      assetsFolderId,
    }
  }
}
