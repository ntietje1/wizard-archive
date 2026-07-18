import type { VersionStamp } from './component-version'
import { assertDomainId, DOMAIN_ID_KIND, isUuidV7 } from './domain-id'
import type { CampaignId, CampaignMemberId, ResourceId } from './domain-id'
import type { GrantedResourcePermission } from './resource-access-policy'
import { RESOURCE_KIND } from './resource-record'
import type {
  ResourceColor,
  ResourceIcon,
  ResourceKind,
  ResourceRecord,
  ResourceTitle,
} from './resource-record'

declare const indexRevisionBrand: unique symbol
declare const resourceCollectionKeyBrand: unique symbol

export const RESOURCE_INDEX_SCHEMA = 'resource-index-v1'
const RESOURCE_KINDS: ReadonlySet<string> = new Set(Object.values(RESOURCE_KIND))

export type IndexRevision = string & { readonly [indexRevisionBrand]: true }
export type ResourceCollectionKey = string & { readonly [resourceCollectionKeyBrand]: true }
export type ResourceProjection = 'dm' | 'player' | 'view_as_player' | 'local'

export type ResourceProjectionScope = Readonly<{
  campaignId: CampaignId
  actorId: CampaignMemberId
  projection: ResourceProjection
  schema: typeof RESOURCE_INDEX_SCHEMA
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
  permission: GrantedResourcePermission
  metadataVersion: VersionStamp
  createdAt: number
  updatedAt: number
}>

export function authorizedResourceSummaryFromRecord(
  resource: ResourceRecord,
  permission: GrantedResourcePermission,
  displayParentId: ResourceId | null = resource.parentId,
): AuthorizedResourceSummary {
  return {
    id: resource.id,
    campaignId: resource.campaignId,
    displayParentId,
    kind: resource.kind,
    title: resource.title,
    icon: resource.icon,
    color: resource.color,
    lifecycle: resource.lifecycle.state,
    permission,
    metadataVersion: resource.metadataVersion,
    createdAt: resource.created.at,
    updatedAt: resource.updated.at,
  }
}

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
  applyProjectionSnapshot(
    snapshot: AuthorizedResourceSnapshot,
    nextRevision: IndexRevision,
  ): ResourceIndexApplyResult
  applyAuthoritativeProjectionSnapshot(
    snapshot: AuthorizedResourceSnapshot,
    nextRevision: IndexRevision,
  ): ResourceIndexApplyResult
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
    (!Array.isArray(query.kinds) || query.kinds.some((kind) => !RESOURCE_KINDS.has(kind)))
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

export function sameResourceProjectionScope(
  left: ResourceProjectionScope,
  right: ResourceProjectionScope,
): boolean {
  return (
    left.campaignId === right.campaignId &&
    left.actorId === right.actorId &&
    left.projection === right.projection &&
    left.schema === right.schema
  )
}

export function resourceCollectionQueryKey(query: ResourceCollectionQuery): ResourceCollectionKey {
  const normalized = normalizeResourceCollectionQuery(query)
  return JSON.stringify({
    parentId: normalized.parentId,
    lifecycle: normalized.lifecycle,
    kinds: normalized.kinds ?? null,
  }) as ResourceCollectionKey
}

export function resourceCollectionQueryFromKey(
  key: ResourceCollectionKey,
): ResourceCollectionQuery {
  const value: unknown = JSON.parse(key)
  if (!value || typeof value !== 'object') throw new TypeError('Invalid resource collection key')
  const candidate = value as Record<string, unknown>
  if (
    (candidate.parentId !== null && typeof candidate.parentId !== 'string') ||
    (candidate.lifecycle !== 'active' && candidate.lifecycle !== 'trashed') ||
    (candidate.kinds !== null && !isResourceKinds(candidate.kinds))
  ) {
    throw new TypeError('Invalid resource collection key')
  }
  const parentId =
    candidate.parentId === null ? null : assertDomainId(DOMAIN_ID_KIND.resource, candidate.parentId)
  return normalizeResourceCollectionQuery({
    parentId,
    lifecycle: candidate.lifecycle,
    ...(candidate.kinds === null ? {} : { kinds: candidate.kinds }),
  })
}

function isResourceKinds(value: unknown): value is Array<ResourceKind> {
  return Array.isArray(value) && value.every(isResourceKind)
}

function isResourceKind(value: unknown): value is ResourceKind {
  return typeof value === 'string' && RESOURCE_KINDS.has(value)
}

export function resourceMatchesCollectionQuery(
  resource: AuthorizedResourceSummary,
  query: ResourceCollectionQuery,
): boolean {
  return (
    resource.displayParentId === query.parentId &&
    resource.lifecycle === query.lifecycle &&
    (query.kinds === undefined || query.kinds.includes(resource.kind))
  )
}
