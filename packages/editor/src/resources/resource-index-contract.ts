import type { VersionStamp } from './component-version'
import { isUuidV7 } from './domain-id'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import { RESOURCE_KIND } from './resource-contract'
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

export type ResourceIndexApplyResult =
  | { readonly status: 'applied' }
  | { readonly status: 'duplicate' }
  | {
      readonly status: 'replacement_required'
      readonly reason: 'invalid_projection' | 'revision_mismatch' | 'wrong_scope'
    }

export interface WorkspaceResourceIndexController extends WorkspaceResourceIndex {
  replaceScope(scope: ResourceProjectionScope, revision: IndexRevision): void
  replaceSnapshot(snapshot: AuthorizedResourceSnapshot): ResourceIndexApplyResult
  applyChangeSet(changeSet: AuthorizedResourceChangeSet): ResourceIndexApplyResult
}

export function normalizeResourceCollectionQuery(
  query: ResourceCollectionQuery,
): ResourceCollectionQuery {
  if (query.parentId !== null && !isUuidV7(query.parentId)) {
    throw new TypeError('Invalid resource collection parent')
  }
  if (query.lifecycle !== 'active' && query.lifecycle !== 'trashed') {
    throw new TypeError('Invalid resource collection lifecycle')
  }
  if (
    query.kinds !== undefined &&
    (!Array.isArray(query.kinds) ||
      query.kinds.some((kind) => !Object.values(RESOURCE_KIND).includes(kind)))
  ) {
    throw new TypeError('Invalid resource collection kinds')
  }
  return {
    parentId: query.parentId,
    lifecycle: query.lifecycle,
    ...(query.kinds === undefined
      ? {}
      : {
          kinds: Array.from(new Set(query.kinds)).sort((left, right) => left.localeCompare(right)),
        }),
  }
}
