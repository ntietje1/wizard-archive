import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ApplicationResourceRole,
  ResourceCatalogPage,
  ResourceCatalogReader,
  ResourceCatalogSnapshot,
  SourcePathAlias,
} from '@wizard-archive/editor/resources/catalog-contract'
import { assertResourceCatalogPageSize } from '@wizard-archive/editor/resources/catalog-contract'
import type { ResourceRecord } from '@wizard-archive/editor/resources/resource-record'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTombstone } from '@wizard-archive/editor/resources/resource-metadata-version'
import { assertVersionStamp } from '@wizard-archive/editor/resources/component-version'
import type { Doc } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'

function toResourceRecord(resource: Doc<'resources'>): ResourceRecord {
  const campaignId = assertDomainId(DOMAIN_ID_KIND.campaign, resource.campaignUuid)
  const id = assertDomainId(DOMAIN_ID_KIND.resource, resource.resourceUuid)
  const parentId =
    resource.parentResourceUuid === null
      ? null
      : assertDomainId(DOMAIN_ID_KIND.resource, resource.parentResourceUuid)
  const createdBy = assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.createdByMemberUuid)
  const updatedBy = assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.updatedByMemberUuid)
  return {
    id,
    campaignId,
    parentId,
    kind: resource.kind,
    title: canonicalizeResourceTitle(resource.title),
    icon: resource.icon,
    color: resource.color,
    lifecycle:
      resource.lifecycle === 'active'
        ? { state: 'active' }
        : {
            state: 'trashed',
            at: resource.trashedAt,
            by: assertDomainId(DOMAIN_ID_KIND.campaignMember, resource.trashedByMemberUuid),
          },
    metadataVersion: assertVersionStamp(resource.metadataVersion),
    created: { at: resource.createdAt, by: createdBy },
    updated: { at: resource.updatedAt, by: updatedBy },
  }
}

function toTombstone(tombstone: Doc<'resourceTombstones'>): ResourceTombstone {
  return {
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, tombstone.resourceUuid),
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, tombstone.campaignUuid),
    deletionVersion: assertVersionStamp(tombstone.deletionVersion),
    deletedAt: tombstone.deletedAt,
  }
}

function toAlias(alias: Doc<'resourceSourcePathAliases'>): SourcePathAlias {
  return {
    campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, alias.campaignUuid),
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, alias.resourceUuid),
    firstSeenImportJobId: assertDomainId(DOMAIN_ID_KIND.importJob, alias.firstSeenImportJobUuid),
    sourceRootId: alias.sourceRootId,
    value: { rawPath: alias.rawPath, normalizedPath: alias.normalizedPath },
  }
}

function toRole(role: Doc<'resourceRoles'>): ApplicationResourceRole {
  return {
    role: role.role,
    resourceId: assertDomainId(DOMAIN_ID_KIND.resource, role.resourceUuid),
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
    return resource?.campaignUuid === campaignId ? toResourceRecord(resource) : null
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
    const items = page.slice(0, limit).map(toResourceRecord)
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
      .withIndex('by_campaign_and_resource_and_normalizedPath', (query) =>
        query.eq('campaignUuid', campaignId).eq('resourceUuid', resourceId),
      )
      .collect()
    return aliases.map(toAlias)
  }

  async listRoles(campaignId: CampaignId): Promise<ReadonlyArray<ApplicationResourceRole>> {
    const roles = await this.db
      .query('resourceRoles')
      .withIndex('by_campaign_and_role', (query) => query.eq('campaignUuid', campaignId))
      .collect()
    return roles.map(toRole)
  }

  async readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot> {
    const [resources, tombstones, aliases, roles] = await Promise.all([
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
        .withIndex('by_campaign_and_resource_and_normalizedPath', (query) =>
          query.eq('campaignUuid', campaignId),
        )
        .collect(),
      this.listRoles(campaignId),
    ])
    return {
      campaignId,
      resources: resources.map(toResourceRecord),
      tombstones: tombstones.map(toTombstone),
      aliases: aliases.map(toAlias),
      roles,
    }
  }
}
