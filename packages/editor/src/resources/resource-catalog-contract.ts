import type { CampaignId, ImportJobId, ResourceId } from './domain-id'
import type { ResourceRecord } from './resource-record'
import type { ResourceTombstone } from './resource-metadata-version'

export const MAX_RESOURCE_CATALOG_PAGE_SIZE = 200

export function assertResourceCatalogPageSize(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_RESOURCE_CATALOG_PAGE_SIZE) {
    throw new RangeError(
      `Resource catalog page size must be between 1 and ${MAX_RESOURCE_CATALOG_PAGE_SIZE}`,
    )
  }
}

export type SourcePathAlias = Readonly<{
  campaignId: CampaignId
  resourceId: ResourceId
  importJobId: ImportJobId
  sourceRootId: string
  rawPath: string
  normalizedPath: string
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
  assetsFolderId: ResourceId | null
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
  getAssetsFolder(campaignId: CampaignId): Promise<ResourceId | null>
  readSnapshot(campaignId: CampaignId): Promise<ResourceCatalogSnapshot>
}

export interface ResourceCatalogSnapshotSource {
  getSnapshot(campaignId: CampaignId): ResourceCatalogSnapshot
  subscribe(campaignId: CampaignId, listener: () => void): () => void
}
