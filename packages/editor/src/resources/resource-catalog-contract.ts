import type { CampaignId, CampaignMemberId, ImportJobId, ResourceId } from './domain-id'
import type {
  AuditStamp,
  ResourceColor,
  ResourceIcon,
  ResourceRecord,
  ResourceTitle,
} from './resource-contract'
import type { ResourceTombstone } from './resource-metadata-version'

export const MAX_RESOURCE_CATALOG_PAGE_SIZE = 200

export function assertResourceCatalogPageSize(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RESOURCE_CATALOG_PAGE_SIZE) {
    throw new RangeError(
      `Resource catalog page size must be between 1 and ${MAX_RESOURCE_CATALOG_PAGE_SIZE}`,
    )
  }
}

export type SourcePathAliasValue = Readonly<{
  rawPath: string
  normalizedPath: string
}>

export type SourcePathAlias = Readonly<{
  campaignId: CampaignId
  resourceId: ResourceId
  firstSeenImportJobId: ImportJobId
  sourceRootId: string
  value: SourcePathAliasValue
}>

export type ApplicationResourceRole = Readonly<{
  role: string
  resourceId: ResourceId
}>

export type ResourceCatalogPage<T> = Readonly<{
  items: ReadonlyArray<T>
  cursor: string | null
}>

export type ResourceCatalogSnapshot = Readonly<{
  campaignId: CampaignId
  resources: ReadonlyArray<ResourceRecord>
  tombstones: ReadonlyArray<ResourceTombstone>
  aliases: ReadonlyArray<SourcePathAlias>
  roles: ReadonlyArray<ApplicationResourceRole>
}>

export interface ResourceCatalogReader {
  getResource(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceRecord | null>
  getResources(
    campaignId: CampaignId,
    resourceIds: ReadonlyArray<ResourceId>,
  ): Promise<ReadonlyArray<ResourceRecord>>
  listChildren(
    campaignId: CampaignId,
    parentId: ResourceId | null,
    lifecycle: 'active' | 'trashed',
    limit: number,
    cursor: string | null,
  ): Promise<ResourceCatalogPage<ResourceRecord>>
  getTombstone(campaignId: CampaignId, resourceId: ResourceId): Promise<ResourceTombstone | null>
  listAliases(
    campaignId: CampaignId,
    resourceId: ResourceId,
  ): Promise<ReadonlyArray<SourcePathAlias>>
  listRoles(campaignId: CampaignId): Promise<ReadonlyArray<ApplicationResourceRole>>
  readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot>
}

export type ResourceMetadataChanges = Readonly<{
  parentId?: ResourceId | null
  title?: ResourceTitle
  icon?: ResourceIcon | null
  color?: ResourceColor | null
}>

export type ResourceCatalogDeleteResult = Readonly<{
  deletedResourceIds: ReadonlyArray<ResourceId>
  tombstones: ReadonlyArray<ResourceTombstone>
}>

export interface ResourceCatalogTransactionWriter {
  insertResource(resource: ResourceRecord): Promise<void>
  updateMetadata(
    campaignId: CampaignId,
    resourceId: ResourceId,
    changes: ResourceMetadataChanges,
    audit: AuditStamp,
  ): Promise<ResourceRecord>
  trashTrees(
    campaignId: CampaignId,
    rootIds: ReadonlyArray<ResourceId>,
    at: number,
    actorId: CampaignMemberId,
  ): Promise<ReadonlyArray<ResourceRecord>>
  restoreTrees(
    campaignId: CampaignId,
    rootIds: ReadonlyArray<ResourceId>,
    at: number,
    actorId: CampaignMemberId,
  ): Promise<ReadonlyArray<ResourceRecord>>
  permanentlyDeleteTrees(
    campaignId: CampaignId,
    rootIds: ReadonlyArray<ResourceId>,
    deletedAt: number,
  ): Promise<ResourceCatalogDeleteResult>
  appendAlias(alias: SourcePathAlias): Promise<SourcePathAlias>
  setRole(campaignId: CampaignId, role: ApplicationResourceRole): Promise<void>
  removeRole(campaignId: CampaignId, role: string): Promise<void>
}
