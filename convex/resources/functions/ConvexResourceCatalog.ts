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
import type { ResourceKind, ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceCollectionQuery } from '@wizard-archive/editor/resources/index-contract'
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

type ResourceRow = Doc<'resources'>

async function scanResourcePage({
  accept,
  after,
  kinds,
  limit,
  load,
}: {
  accept: (row: ResourceRow) => boolean | Promise<boolean>
  after: ResourceId | null
  kinds: ReadonlySet<ResourceKind> | null
  limit: number
  load: (after: ResourceId | null) => Promise<ReadonlyArray<ResourceRow>>
}): Promise<ResourceCatalogPage<ResourceRecord>> {
  const items: Array<ResourceRecord> = []
  let scanAfter = after
  while (true) {
    const page = await load(scanAfter)
    for (const row of page) {
      if (kinds !== null && !kinds.has(row.kind)) continue
      if (!(await accept(row))) continue
      if (items.length === limit) return { items, cursor: items[items.length - 1]!.id }
      items.push(resourceRecordFromRow(row))
    }
    if (page.length <= limit) return { items, cursor: null }
    scanAfter = assertDomainId(DOMAIN_ID_KIND.resource, page[page.length - 1]!.resourceUuid)
  }
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

  async listCollection(
    campaignId: CampaignId,
    collection: ResourceCollectionQuery,
    limit: number,
    cursor: string | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>> {
    assertResourceCatalogPageSize(limit)
    const after = cursor === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, cursor)
    const kinds = collection.kinds === undefined ? null : new Set(collection.kinds)
    if (collection.parentId === null && collection.lifecycle === 'trashed') {
      return await this.listTrashRoots(campaignId, kinds, limit, after)
    }
    return await scanResourcePage({
      after,
      kinds,
      limit,
      accept: () => true,
      load: async (next) => {
        const query = this.db
          .query('resources')
          .withIndex('by_campaign_and_parent_and_lifecycle_and_resource', (indexQuery) => {
            const scoped = indexQuery
              .eq('campaignUuid', campaignId)
              .eq('parentResourceUuid', collection.parentId)
              .eq('lifecycle', collection.lifecycle)
            return next === null ? scoped : scoped.gt('resourceUuid', next)
          })
        return await query.take(limit + 1)
      },
    })
  }

  private async listTrashRoots(
    campaignId: CampaignId,
    kinds: ReadonlySet<ResourceKind> | null,
    limit: number,
    after: ResourceId | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>> {
    return await scanResourcePage({
      after,
      kinds,
      limit,
      accept: async (row) => {
        if (row.parentResourceUuid === null) return true
        const parent = await this.getResource(
          campaignId,
          assertDomainId(DOMAIN_ID_KIND.resource, row.parentResourceUuid),
        )
        return parent?.lifecycle.state !== 'trashed'
      },
      load: async (next) => {
        const query = this.db
          .query('resources')
          .withIndex('by_campaign_and_lifecycle_and_resource', (indexQuery) => {
            const scoped = indexQuery.eq('campaignUuid', campaignId).eq('lifecycle', 'trashed')
            return next === null ? scoped : scoped.gt('resourceUuid', next)
          })
        return await query.take(limit + 1)
      },
    })
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

  async readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    const [resources, tombstones, aliases] = await Promise.all([
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
    ])
    return {
      campaignId,
      resources: resources.map(resourceRecordFromRow),
      tombstones: tombstones.map(toTombstone),
      aliases: aliases.map(toAlias),
    }
  }
}
