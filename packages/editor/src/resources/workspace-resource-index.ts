import { isUuidV7 } from './domain-id'
import type { ResourceId } from './domain-id'
import { isVersionStamp } from './component-version'
import type {
  AuthorizedResourceChangeSet,
  AuthorizedResourceSnapshot,
  AuthorizedResourceSummary,
  CollectionKnowledge,
  IndexRevision,
  ResourceCollectionQuery,
  ResourceIndexApplyResult,
  ResourceIndexLoader,
  ResourceKnowledge,
  ResourceCollectionKey,
  ResourceLoadResult,
  ResourceProjectionScope,
  WorkspaceResourceIndex,
  WorkspaceResourceIndexController,
  WorkspaceResourceIndexSnapshot,
} from './resource-index-contract'
import {
  normalizeResourceCollectionQuery,
  resourceCollectionQueryKey,
  resourceMatchesCollectionQuery,
  sameResourceProjectionScope,
} from './resource-index-contract'
import { RESOURCE_KIND, canonicalizeResourceTitle } from './resource-record'
import type { ResourceKind } from './resource-record'

export type ResourceIndexLoadSource = Readonly<{
  loadResource(scope: ResourceProjectionScope, resourceId: ResourceId): Promise<ResourceLoadResult>
  loadCollection(
    scope: ResourceProjectionScope,
    query: ResourceCollectionQuery,
  ): Promise<ResourceLoadResult>
}>

export type AuthorizedResourceSort = 'created' | 'title' | 'updated'
export type AuthorizedResourceSortDirection = 'ascending' | 'descending'

type StoredCollection = Readonly<{
  query: ResourceCollectionQuery
  resourceIds: ReadonlyArray<ResourceId>
  complete: boolean
}>

type IndexState = Readonly<{
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>
  missingResourceIds: ReadonlySet<ResourceId>
  collections: ReadonlyMap<ResourceCollectionKey, StoredCollection>
}>

const emptyState = (): IndexState => ({
  resources: new Map(),
  missingResourceIds: new Set(),
  collections: new Map(),
})

const resourceKinds = new Set<ResourceKind>(Object.values(RESOURCE_KIND))

function fixedSummary(resource: AuthorizedResourceSummary): object {
  return {
    id: resource.id,
    campaignId: resource.campaignId,
    displayParentId: resource.displayParentId,
    kind: resource.kind,
    title: resource.title,
    icon: resource.icon,
    color: resource.color,
    lifecycle: resource.lifecycle,
    metadataVersion: resource.metadataVersion,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  }
}

function stateSignature(state: IndexState): string {
  return JSON.stringify({
    resources: Array.from(state.resources.values())
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(fixedSummary),
    missingResourceIds: Array.from(state.missingResourceIds).sort(),
    collections: Array.from(state.collections.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, collection]) => [key, collection.resourceIds, collection.complete]),
  })
}

function changeSetSignature(changeSet: AuthorizedResourceChangeSet): string {
  return JSON.stringify({
    scope: changeSet.scope,
    baseRevision: changeSet.baseRevision,
    nextRevision: changeSet.nextRevision,
    changes: changeSet.changes.map((change) =>
      change.type === 'remove'
        ? { type: change.type, resourceId: change.resourceId }
        : { type: change.type, resource: fixedSummary(change.resource) },
    ),
  })
}

function hasCompleteAncestorSpines(
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): boolean {
  for (const resource of resources.values()) {
    const visited = new Set<ResourceId>([resource.id])
    let parentId = resource.displayParentId
    while (parentId !== null) {
      if (visited.has(parentId)) return false
      visited.add(parentId)
      const parent = resources.get(parentId)
      if (!parent || parent.kind !== 'folder') return false
      parentId = parent.displayParentId
    }
  }
  return true
}

function projectSummary(
  resource: AuthorizedResourceSummary,
  scope: ResourceProjectionScope,
): AuthorizedResourceSummary | null {
  let title
  try {
    title = canonicalizeResourceTitle(resource.title)
  } catch {
    return null
  }
  if (
    !isUuidV7(resource.id) ||
    resource.campaignId !== scope.campaignId ||
    (resource.displayParentId !== null && !isUuidV7(resource.displayParentId)) ||
    !resourceKinds.has(resource.kind) ||
    title !== resource.title ||
    (resource.icon !== null && typeof resource.icon !== 'string') ||
    (resource.color !== null && typeof resource.color !== 'string') ||
    (resource.lifecycle !== 'active' && resource.lifecycle !== 'trashed') ||
    !isVersionStamp(resource.metadataVersion) ||
    !Number.isSafeInteger(resource.createdAt) ||
    resource.createdAt < 0 ||
    !Number.isSafeInteger(resource.updatedAt) ||
    resource.updatedAt < 0
  ) {
    return null
  }
  return {
    id: resource.id,
    campaignId: resource.campaignId,
    displayParentId: resource.displayParentId,
    kind: resource.kind,
    title,
    icon: resource.icon,
    color: resource.color,
    lifecycle: resource.lifecycle,
    metadataVersion: resource.metadataVersion,
    createdAt: resource.createdAt,
    updatedAt: resource.updatedAt,
  }
}

function createResourceMap(
  snapshot: AuthorizedResourceSnapshot,
): Map<ResourceId, AuthorizedResourceSummary> | null {
  const resources = new Map<ResourceId, AuthorizedResourceSummary>()
  for (const resource of snapshot.resources) {
    const projected = projectSummary(resource, snapshot.scope)
    if (!projected || resources.has(projected.id)) return null
    resources.set(projected.id, projected)
  }
  return hasCompleteAncestorSpines(resources) ? resources : null
}

function createMissingSet(
  resourceIds: ReadonlyArray<ResourceId>,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): Set<ResourceId> | null {
  const missingResourceIds = new Set<ResourceId>()
  for (const resourceId of resourceIds) {
    if (!isUuidV7(resourceId) || resources.has(resourceId) || missingResourceIds.has(resourceId)) {
      return null
    }
    missingResourceIds.add(resourceId)
  }
  return missingResourceIds
}

function createStoredCollection(
  collection: AuthorizedResourceSnapshot['collections'][number],
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): StoredCollection | null {
  let query: ResourceCollectionQuery
  try {
    query = normalizeResourceCollectionQuery(collection.query)
  } catch {
    return null
  }
  const resourceIdSet = new Set(collection.resourceIds)
  if (resourceIdSet.size !== collection.resourceIds.length) return null
  const resourceIds = Array.from(resourceIdSet).sort()
  const items = resourceIds.map((resourceId) => resources.get(resourceId))
  if (items.some((resource) => !resource || !resourceMatchesCollectionQuery(resource, query))) {
    return null
  }
  if (
    collection.complete &&
    Array.from(resources.values()).some(
      (resource) =>
        resourceMatchesCollectionQuery(resource, query) && !resourceIdSet.has(resource.id),
    )
  ) {
    return null
  }
  return { query, resourceIds, complete: collection.complete }
}

function createCollectionMap(
  snapshot: AuthorizedResourceSnapshot,
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
): Map<ResourceCollectionKey, StoredCollection> | null {
  const collections = new Map<ResourceCollectionKey, StoredCollection>()
  for (const source of snapshot.collections) {
    const collection = createStoredCollection(source, resources)
    if (!collection) return null
    const key = resourceCollectionQueryKey(collection.query)
    if (collections.has(key)) return null
    collections.set(key, collection)
  }
  return collections
}

function createState(snapshot: AuthorizedResourceSnapshot): IndexState | null {
  const resources = createResourceMap(snapshot)
  if (!resources) return null
  const missingResourceIds = createMissingSet(snapshot.missingResourceIds, resources)
  if (!missingResourceIds) return null
  const collections = createCollectionMap(snapshot, resources)
  if (!collections) return null
  return { resources, missingResourceIds, collections }
}

function matchingResourceIds(
  resources: Iterable<AuthorizedResourceSummary>,
  query: ResourceCollectionQuery,
): Array<ResourceId> {
  const resourceIds: Array<ResourceId> = []
  for (const resource of resources) {
    if (resourceMatchesCollectionQuery(resource, query)) resourceIds.push(resource.id)
  }
  return resourceIds.sort()
}

function mergeProjectionState(current: IndexState, projection: IndexState): IndexState | null {
  const resourceState = mergeProjectionResources(current, projection)
  if (!resourceState) return null
  const collections = mergeProjectionCollections(
    resourceState.resources,
    current.collections,
    projection.collections,
  )
  return hasCompleteAncestorSpines(resourceState.resources)
    ? { ...resourceState, collections }
    : null
}

function mergeProjectionResources(current: IndexState, projection: IndexState) {
  const resources = new Map(current.resources)
  const missingResourceIds = new Set(current.missingResourceIds)
  for (const resource of projection.resources.values()) {
    const existing = resources.get(resource.id)
    const decision = projectedResourceDecision(existing, resource)
    if (decision === 'stale') continue
    if (decision === 'conflict') return null
    resources.set(resource.id, resource)
    missingResourceIds.delete(resource.id)
  }
  for (const resourceId of projection.missingResourceIds) {
    resources.delete(resourceId)
    missingResourceIds.add(resourceId)
  }
  return { resources, missingResourceIds }
}

function projectedResourceDecision(
  existing: AuthorizedResourceSummary | undefined,
  projected: AuthorizedResourceSummary,
) {
  if (!existing) return 'apply' as const
  if (projected.metadataVersion.revision < existing.metadataVersion.revision) {
    return 'stale' as const
  }
  if (
    projected.metadataVersion.revision === existing.metadataVersion.revision &&
    projected.metadataVersion.digest !== existing.metadataVersion.digest
  ) {
    return 'conflict' as const
  }
  return 'apply' as const
}

function mergeProjectionCollections(
  resources: ReadonlyMap<ResourceId, AuthorizedResourceSummary>,
  current: ReadonlyMap<ResourceCollectionKey, StoredCollection>,
  projection: ReadonlyMap<ResourceCollectionKey, StoredCollection>,
) {
  const collections = new Map(
    Array.from(
      current,
      ([key, collection]) =>
        [
          key,
          {
            ...collection,
            resourceIds: matchingResourceIds(resources.values(), collection.query),
          },
        ] as const,
    ),
  )
  for (const [key, collection] of projection) {
    const existing = collections.get(key)
    collections.set(key, {
      query: collection.query,
      resourceIds: matchingResourceIds(resources.values(), collection.query),
      complete: existing?.complete === true || collection.complete,
    })
  }
  return collections
}

function applyResourceChange(
  resources: Map<ResourceId, AuthorizedResourceSummary>,
  missingResourceIds: Set<ResourceId>,
  change: AuthorizedResourceChangeSet['changes'][number],
  scope: ResourceProjectionScope,
): ResourceId | null {
  const resourceId = change.type === 'upsert' ? change.resource.id : change.resourceId
  if (!isUuidV7(resourceId)) return null
  if (change.type === 'remove') {
    resources.delete(resourceId)
    missingResourceIds.add(resourceId)
    return resourceId
  }
  const projected = projectSummary(change.resource, scope)
  if (!projected) return null
  resources.set(resourceId, projected)
  missingResourceIds.delete(resourceId)
  return resourceId
}

function reconcileCollections(
  collections: Map<ResourceCollectionKey, StoredCollection>,
  resourceId: ResourceId,
  resource: AuthorizedResourceSummary | undefined,
): void {
  for (const [key, collection] of collections) {
    const resourceIds = collection.resourceIds.filter((candidate) => candidate !== resourceId)
    if (resource && resourceMatchesCollectionQuery(resource, collection.query)) {
      resourceIds.push(resourceId)
      resourceIds.sort()
    }
    collections.set(key, { ...collection, resourceIds })
  }
}

function applyChanges(
  state: IndexState,
  changeSet: AuthorizedResourceChangeSet,
): IndexState | null {
  const resources = new Map(state.resources)
  const missingResourceIds = new Set(state.missingResourceIds)
  const collections = new Map(
    Array.from(state.collections, ([key, collection]) => [
      key,
      { ...collection, resourceIds: [...collection.resourceIds] },
    ]),
  )

  const changedResourceIds = new Set<ResourceId>()
  for (const change of changeSet.changes) {
    const resourceId = applyResourceChange(resources, missingResourceIds, change, changeSet.scope)
    if (!resourceId || changedResourceIds.has(resourceId)) return null
    changedResourceIds.add(resourceId)
    reconcileCollections(collections, resourceId, resources.get(resourceId))
  }

  return hasCompleteAncestorSpines(resources)
    ? { resources, missingResourceIds, collections }
    : null
}

function createSnapshot(
  scope: ResourceProjectionScope,
  revision: IndexRevision,
  state: IndexState,
): WorkspaceResourceIndexSnapshot {
  return {
    scope,
    revision,
    lookup: (resourceId) => lookup(state, resourceId),
    list: (query) => list(state, query),
    ancestors: (resourceId) => ancestors(state, resourceId),
  }
}

function lookup(
  state: IndexState,
  resourceId: ResourceId,
): ResourceKnowledge<AuthorizedResourceSummary> {
  const resource = state.resources.get(resourceId)
  if (resource) return { state: 'known', value: resource }
  return state.missingResourceIds.has(resourceId) ? { state: 'missing' } : { state: 'unknown' }
}

function list(
  state: IndexState,
  query: ResourceCollectionQuery,
): CollectionKnowledge<AuthorizedResourceSummary> {
  const collection = state.collections.get(resourceCollectionQueryKey(query))
  if (!collection) return { state: 'unknown' }
  return {
    state: 'known',
    items: collection.resourceIds.map((resourceId) => state.resources.get(resourceId)!),
    complete: collection.complete,
  }
}

function ancestors(
  state: IndexState,
  resourceId: ResourceId,
): ResourceKnowledge<ReadonlyArray<AuthorizedResourceSummary>> {
  const knowledge = lookup(state, resourceId)
  if (knowledge.state !== 'known') return knowledge
  const result: Array<AuthorizedResourceSummary> = []
  let parentId = knowledge.value.displayParentId
  while (parentId !== null) {
    const parent = state.resources.get(parentId)!
    result.push(parent)
    parentId = parent.displayParentId
  }
  return { state: 'known', value: result.reverse() }
}

export function indexRevision(value: string): IndexRevision {
  if (value.length === 0) throw new TypeError('Index revision cannot be empty')
  return value as IndexRevision
}

export class MutableWorkspaceResourceIndex implements WorkspaceResourceIndexController {
  #scope: ResourceProjectionScope
  #revision: IndexRevision
  #state: IndexState = emptyState()
  #snapshot: WorkspaceResourceIndexSnapshot
  #appliedChangeSetSignatures = new Set<string>()
  #revisionSignatures: Map<IndexRevision, string>
  readonly #listeners = new Set<() => void>()

  constructor(scope: ResourceProjectionScope, revision: IndexRevision) {
    this.#scope = scope
    this.#revision = revision
    this.#snapshot = createSnapshot(scope, revision, this.#state)
    this.#revisionSignatures = new Map([[revision, stateSignature(this.#state)]])
  }

  getSnapshot(): WorkspaceResourceIndexSnapshot {
    return this.#snapshot
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  replaceScope(scope: ResourceProjectionScope, revision: IndexRevision): void {
    if (sameResourceProjectionScope(this.#scope, scope) && this.#revision === revision) return
    this.#scope = scope
    this.#revision = revision
    this.#state = emptyState()
    this.#appliedChangeSetSignatures = new Set()
    this.#revisionSignatures = new Map([[revision, stateSignature(this.#state)]])
    this.#publish()
  }

  replaceSnapshot(snapshot: AuthorizedResourceSnapshot): ResourceIndexApplyResult {
    if (!sameResourceProjectionScope(this.#scope, snapshot.scope)) {
      return { status: 'replacement_required', reason: 'wrong_scope' }
    }
    const state = createState(snapshot)
    if (!state) return { status: 'replacement_required', reason: 'invalid_projection' }
    const signature = stateSignature(state)
    const knownSignature = this.#revisionSignatures.get(snapshot.revision)
    if (knownSignature === signature) return { status: 'duplicate' }
    if (knownSignature !== undefined) {
      return { status: 'replacement_required', reason: 'invalid_projection' }
    }
    this.#revision = snapshot.revision
    this.#state = state
    this.#revisionSignatures.set(snapshot.revision, signature)
    this.#publish()
    return { status: 'applied' }
  }

  applyProjectionSnapshot(
    snapshot: AuthorizedResourceSnapshot,
    nextRevision: IndexRevision,
  ): ResourceIndexApplyResult {
    if (!sameResourceProjectionScope(this.#scope, snapshot.scope)) {
      return { status: 'replacement_required', reason: 'wrong_scope' }
    }
    const projection = createState(snapshot)
    if (!projection) return { status: 'replacement_required', reason: 'invalid_projection' }
    const currentSignature = stateSignature(this.#state)
    const state = mergeProjectionState(this.#state, projection)
    if (!state) return { status: 'replacement_required', reason: 'invalid_projection' }
    const signature = stateSignature(state)
    if (signature === currentSignature) return { status: 'duplicate' }
    const knownSignature = this.#revisionSignatures.get(nextRevision)
    if (knownSignature !== undefined && knownSignature !== signature) {
      return { status: 'replacement_required', reason: 'invalid_projection' }
    }
    this.#revision = nextRevision
    this.#state = state
    this.#revisionSignatures.set(nextRevision, signature)
    this.#publish()
    return { status: 'applied' }
  }

  applyChangeSet(changeSet: AuthorizedResourceChangeSet): ResourceIndexApplyResult {
    if (!sameResourceProjectionScope(this.#scope, changeSet.scope)) {
      return { status: 'replacement_required', reason: 'wrong_scope' }
    }
    const signature = changeSetSignature(changeSet)
    if (this.#appliedChangeSetSignatures.has(signature)) return { status: 'duplicate' }
    if (changeSet.baseRevision !== this.#revision) {
      return { status: 'replacement_required', reason: 'revision_mismatch' }
    }
    if (changeSet.nextRevision === changeSet.baseRevision) {
      return { status: 'replacement_required', reason: 'invalid_projection' }
    }
    const state = applyChanges(this.#state, changeSet)
    if (!state) return { status: 'replacement_required', reason: 'invalid_projection' }
    const nextSignature = stateSignature(state)
    const knownSignature = this.#revisionSignatures.get(changeSet.nextRevision)
    if (knownSignature !== undefined && knownSignature !== nextSignature) {
      return { status: 'replacement_required', reason: 'invalid_projection' }
    }
    this.#revision = changeSet.nextRevision
    this.#state = state
    this.#appliedChangeSetSignatures.add(signature)
    this.#revisionSignatures.set(changeSet.nextRevision, nextSignature)
    this.#publish()
    return { status: 'applied' }
  }

  #publish(): void {
    this.#snapshot = createSnapshot(this.#scope, this.#revision, this.#state)
    for (const listener of this.#listeners) listener()
  }
}

function validLoadResult(value: unknown): value is ResourceLoadResult {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  switch (candidate.status) {
    case 'completed':
    case 'scope_changed':
      return true
    case 'unavailable':
      return (
        candidate.reason === 'capability_not_supported' || candidate.reason === 'scope_unavailable'
      )
    case 'failed':
      return (
        typeof candidate.retryable === 'boolean' &&
        typeof candidate.reason === 'string' &&
        [
          'authorization_changed',
          'invalid_response',
          'network_unavailable',
          'provider_failure',
        ].includes(candidate.reason)
      )
    default:
      return false
  }
}

function invalidLoadResult(): ResourceLoadResult {
  return { status: 'failed', retryable: false, reason: 'invalid_response' }
}

function providerFailure(): ResourceLoadResult {
  return { status: 'failed', retryable: true, reason: 'provider_failure' }
}

async function loadIndexKnowledge(
  index: WorkspaceResourceIndex,
  load: (scope: ResourceProjectionScope) => Promise<ResourceLoadResult>,
  isKnown: () => boolean,
): Promise<ResourceLoadResult> {
  const scope = index.getSnapshot().scope
  let result: unknown
  try {
    result = await load(scope)
  } catch {
    return providerFailure()
  }
  if (!sameResourceProjectionScope(scope, index.getSnapshot().scope)) {
    return { status: 'scope_changed' }
  }
  if (!validLoadResult(result)) return invalidLoadResult()
  if (result.status !== 'completed') return result
  return isKnown() ? result : invalidLoadResult()
}

export function createResourceIndexLoader(
  index: WorkspaceResourceIndex,
  source: ResourceIndexLoadSource,
): ResourceIndexLoader {
  const inFlight = new Map<string, Promise<ResourceLoadResult>>()
  const ensureOnce = (key: string, load: () => Promise<ResourceLoadResult>) => {
    const existing = inFlight.get(key)
    if (existing) return existing
    const request = load().finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key)
    })
    inFlight.set(key, request)
    return request
  }
  return {
    ensureResource: (resourceId) => {
      if (index.getSnapshot().lookup(resourceId).state !== 'unknown') {
        return Promise.resolve({ status: 'completed' })
      }
      return ensureOnce(`resource:${resourceId}`, () =>
        loadIndexKnowledge(
          index,
          (scope) => source.loadResource(scope, resourceId),
          () => index.getSnapshot().lookup(resourceId).state !== 'unknown',
        ),
      )
    },
    ensureCollection: (query) => {
      let normalized: ResourceCollectionQuery
      try {
        normalized = normalizeResourceCollectionQuery(query)
      } catch {
        return Promise.resolve(invalidLoadResult())
      }
      const knowledge = index.getSnapshot().list(normalized)
      if (knowledge.state === 'known' && knowledge.complete) {
        return Promise.resolve({ status: 'completed' })
      }
      return ensureOnce(`collection:${resourceCollectionQueryKey(normalized)}`, () =>
        loadIndexKnowledge(
          index,
          (scope) => source.loadCollection(scope, normalized),
          () => index.getSnapshot().list(normalized).state !== 'unknown',
        ),
      )
    },
  }
}

export function sortAuthorizedResourceSummaries(
  resources: ReadonlyArray<AuthorizedResourceSummary>,
  sort: AuthorizedResourceSort,
  direction: AuthorizedResourceSortDirection,
): ReadonlyArray<AuthorizedResourceSummary> {
  const multiplier = direction === 'ascending' ? 1 : -1
  return [...resources].sort((left, right) => {
    let comparison: number
    switch (sort) {
      case 'title':
        comparison = left.title.localeCompare(right.title, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
        break
      case 'created':
        comparison = left.createdAt - right.createdAt
        break
      case 'updated':
        comparison = left.updatedAt - right.updatedAt
        break
    }
    return comparison === 0 ? left.id.localeCompare(right.id) : comparison * multiplier
  })
}
