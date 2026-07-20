import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type {
  CampaignId,
  CampaignMemberId,
  ResourceId,
} from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceBookmarkGateway,
  WorkspaceSearch,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { WorkspaceSearchOutcome } from '@wizard-archive/editor/resources/search-policy'
import type { ResourceLoadResult } from '@wizard-archive/editor/resources/index-contract'
import {
  addLiveRecentResource,
  getLiveRecentResources,
  subscribeToLiveRecentResources,
} from '../live-recent-resources'

type BookmarkArgs = FunctionArgs<typeof api.resources.mutations.setBookmarkState>
type BookmarkResult = FunctionReturnType<typeof api.resources.mutations.setBookmarkState>
type BookmarkProjection = FunctionReturnType<typeof api.resources.queries.loadBookmarks>
type SearchProjection = FunctionReturnType<typeof api.resources.queries.searchResources>
type StoredProjection = BookmarkProjection['snapshot']
type ApplyProjection = (snapshot: StoredProjection) => ResourceLoadResult

export function createLiveResourceBookmarks(
  campaignId: CampaignId,
  applyProjection: ApplyProjection,
  backend: Readonly<{
    setBookmarkState(args: BookmarkArgs): Promise<BookmarkResult>
    watch(apply: (projection: BookmarkProjection) => void): () => void
  }>,
): Readonly<{ gateway: ResourceBookmarkGateway; start(): void; dispose(): void }> {
  let snapshot:
    | Readonly<{ state: 'unknown' }>
    | Readonly<{ state: 'known'; value: ReadonlySet<ReturnType<typeof resourceId>> }> = {
    state: 'unknown',
  }
  const listeners = new Set<() => void>()
  let unsubscribe: (() => void) | null = null
  return {
    gateway: {
      get: () => snapshot,
      subscribe: (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      setBookmarkState: async (resourceIds, bookmarked) =>
        await backend.setBookmarkState({
          campaignId,
          resourceIds: [...resourceIds],
          bookmarked,
        }),
    },
    start: () => {
      if (unsubscribe) return
      unsubscribe = backend.watch((projection) => {
        let resourceIds: ReadonlyArray<ResourceId>
        try {
          resourceIds = readBookmarkResourceIds(projection.resourceIds, projection.snapshot)
          if (applyProjection(projection.snapshot).status !== 'completed') {
            throw new TypeError('Invalid authorized bookmark projection')
          }
        } catch {
          if (snapshot.state === 'unknown') return
          snapshot = { state: 'unknown' }
          for (const listener of listeners) listener()
          return
        }
        snapshot = { state: 'known', value: new Set(resourceIds) }
        for (const listener of listeners) listener()
      })
    },
    dispose: () => {
      unsubscribe?.()
      unsubscribe = null
    },
  }
}

export function createLiveWorkspaceSearch(
  campaignId: CampaignId,
  actorId: CampaignMemberId,
  applyProjection: ApplyProjection,
  search: (
    args: FunctionArgs<typeof api.resources.queries.searchResources>,
  ) => Promise<SearchProjection>,
): WorkspaceSearch {
  return {
    search: async (query) => {
      const projection = await search({ campaignId, query })
      const results = readSearchResults(projection.results)
      requireSearchProjectionCoverage(
        projection.snapshot,
        new Set(results.map((result) => result.resourceId)),
      )
      if (applyProjection(projection.snapshot).status !== 'completed') {
        throw new TypeError('Invalid authorized search projection')
      }
      return { status: projection.status, results }
    },
    recent: () => getLiveRecentResources(campaignId, actorId),
    subscribeRecent: (listener) => subscribeToLiveRecentResources(campaignId, actorId, listener),
    recordOpened: (id) => addLiveRecentResource(campaignId, actorId, id),
  }
}

function resourceId(value: string) {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function readBookmarkResourceIds(
  values: ReadonlyArray<string>,
  snapshot: StoredProjection,
): ReadonlyArray<ResourceId> {
  const resourceIds = values.map(resourceId)
  const targets = new Set(resourceIds)
  if (targets.size !== resourceIds.length) throw new TypeError('Duplicate projected resource')
  requireBookmarkProjectionCoverage(snapshot, targets)
  return resourceIds
}

function readSearchResults(values: SearchProjection['results']): WorkspaceSearchOutcome['results'] {
  const results = values.map((result) => ({
    resourceId: resourceId(result.resourceId),
    match: result.match,
  }))
  if (new Set(results.map((result) => result.resourceId)).size !== results.length) {
    throw new TypeError('Duplicate search result')
  }
  return results
}

function requireSearchProjectionCoverage(
  snapshot: StoredProjection,
  targets: ReadonlySet<ResourceId>,
): void {
  const { resources } = readProjectionCoverage(snapshot)
  for (const target of targets) {
    if (!resources.has(target)) throw new TypeError('Search result is not projected as known')
    requireCompleteResourceSpine(resources, target)
  }
}

type ProjectionResource = Readonly<{ displayParentId: ResourceId | null }>

function requireBookmarkProjectionCoverage(
  snapshot: StoredProjection,
  targets: ReadonlySet<ResourceId>,
): void {
  const { resources, missing } = readProjectionCoverage(snapshot)
  for (const target of targets) {
    if (missing.has(target)) continue
    if (!resources.has(target)) throw new TypeError('Bookmark is not projected as known or missing')
    requireCompleteResourceSpine(resources, target)
  }
}

function readProjectionCoverage(snapshot: StoredProjection): Readonly<{
  resources: ReadonlyMap<ResourceId, ProjectionResource>
  missing: ReadonlySet<ResourceId>
}> {
  const resources = new Map<ResourceId, Readonly<{ displayParentId: ResourceId | null }>>()
  for (const source of snapshot.resources) {
    const id = resourceId(source.id)
    if (resources.has(id)) throw new TypeError('Duplicate projected resource')
    resources.set(id, {
      displayParentId: source.displayParentId === null ? null : resourceId(source.displayParentId),
    })
  }
  const missing = new Set<ResourceId>()
  for (const value of snapshot.missingResourceIds) {
    const id = resourceId(value)
    if (missing.has(id) || resources.has(id))
      throw new TypeError('Invalid missing resource coverage')
    missing.add(id)
  }
  return { resources, missing }
}

function requireCompleteResourceSpine(
  resources: ReadonlyMap<ResourceId, ProjectionResource>,
  target: ResourceId,
): void {
  let currentId: ResourceId | null = target
  const spine = new Set<ResourceId>()
  while (currentId !== null) {
    if (spine.has(currentId)) throw new TypeError('Projected resource spine contains a cycle')
    spine.add(currentId)
    const resource = resources.get(currentId)
    if (!resource) throw new TypeError('Projected resource coverage is incomplete')
    currentId = resource.displayParentId
  }
}
