import type { VersionStamp } from './component-version'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type { ResourceColor, ResourceIcon, ResourceKind, ResourceTitle } from './resource-contract'

declare const indexRevisionBrand: unique symbol

export type IndexRevision = string & { readonly [indexRevisionBrand]: true }

export type ResourceProjectionScope = Readonly<{
  campaignId: CampaignId
  actorId: CampaignMemberId
  projection: string
  schema: string
}>

export type ResourceKnowledge<T> =
  | { readonly state: 'known'; readonly value: T }
  | { readonly state: 'missing' }
  | { readonly state: 'unknown' }

export type ResourceCollectionQuery = Readonly<{
  parentId: ResourceId | null
  lifecycle: 'active' | 'trashed'
  kinds?: ReadonlyArray<ResourceKind>
}>

export type CollectionKnowledge<T> =
  | { readonly state: 'known'; readonly items: ReadonlyArray<T>; readonly complete: boolean }
  | { readonly state: 'unknown' }

export type AuthorizedResourceSummary = Readonly<{
  id: ResourceId
  campaignId: CampaignId
  displayParentId: ResourceId | null
  kind: ResourceKind
  title: ResourceTitle
  icon: ResourceIcon | null
  color: ResourceColor | null
  lifecycle: 'active' | 'trashed'
  metadataVersion: VersionStamp
  createdAt: number
  updatedAt: number
}>

export interface WorkspaceResourceIndexSnapshot {
  readonly scope: ResourceProjectionScope
  readonly revision: IndexRevision
  lookup(id: ResourceId): ResourceKnowledge<AuthorizedResourceSummary>
  list(query: ResourceCollectionQuery): CollectionKnowledge<AuthorizedResourceSummary>
  ancestors(id: ResourceId): ResourceKnowledge<ReadonlyArray<AuthorizedResourceSummary>>
}

export interface WorkspaceResourceIndex {
  getSnapshot(): WorkspaceResourceIndexSnapshot
  subscribe(listener: () => void): () => void
}

export type ResourceLoadFailureCode =
  | 'authorization_changed'
  | 'invalid_response'
  | 'network_unavailable'
  | 'provider_failure'

export type ResourceLoadResult =
  | { readonly status: 'completed' }
  | {
      readonly status: 'unavailable'
      readonly reason: 'capability_not_supported' | 'scope_unavailable'
    }
  | { readonly status: 'scope_changed' }
  | {
      readonly status: 'failed'
      readonly retryable: boolean
      readonly reason: ResourceLoadFailureCode
    }

export interface ResourceIndexLoader {
  ensureResource(id: ResourceId): Promise<ResourceLoadResult>
  ensureCollection(query: ResourceCollectionQuery): Promise<ResourceLoadResult>
}

export type AuthorizedResourceChange =
  | { readonly type: 'upsert'; readonly resource: AuthorizedResourceSummary }
  | { readonly type: 'remove'; readonly resourceId: ResourceId }

export type AuthorizedResourceSnapshot = Readonly<{
  scope: ResourceProjectionScope
  revision: IndexRevision
  resources: ReadonlyArray<AuthorizedResourceSummary>
  missingResourceIds: ReadonlyArray<ResourceId>
  collections: ReadonlyArray<
    Readonly<{
      query: ResourceCollectionQuery
      resourceIds: ReadonlyArray<ResourceId>
      complete: boolean
    }>
  >
}>

export type AuthorizedResourceChangeSet = Readonly<{
  scope: ResourceProjectionScope
  baseRevision: IndexRevision
  nextRevision: IndexRevision
  changes: ReadonlyArray<AuthorizedResourceChange>
}>

export function normalizeResourceCollectionQuery(
  query: ResourceCollectionQuery,
): ResourceCollectionQuery {
  if (!query.kinds) return query
  return { ...query, kinds: Array.from(new Set(query.kinds)).sort() }
}
