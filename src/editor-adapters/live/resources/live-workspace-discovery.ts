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
  WorkspaceSearchResult,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceLoadResult } from '@wizard-archive/editor/resources/index-contract'
import type { ResourceBookmarkCommandResult } from '@wizard-archive/editor/resources/command-contract'
import {
  addLiveRecentResource,
  getLiveRecentResources,
  subscribeToLiveRecentResources,
} from '../live-recent-resources'

type BookmarkArgs = FunctionArgs<typeof api.resources.mutations.executeBookmarkCommand>
type BookmarkResult = FunctionReturnType<typeof api.resources.mutations.executeBookmarkCommand>
type BookmarkProjection = FunctionReturnType<typeof api.resources.queries.loadBookmarks>
type SearchProjection = FunctionReturnType<typeof api.resources.queries.searchResources>
type StoredProjection = BookmarkProjection['snapshot']
type ApplyProjection = (snapshot: StoredProjection) => ResourceLoadResult

export function createLiveResourceBookmarks(
  campaignId: CampaignId,
  applyProjection: ApplyProjection,
  backend: Readonly<{
    execute(args: BookmarkArgs): Promise<BookmarkResult>
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
      execute: async (envelope) => {
        if (envelope.campaignId !== campaignId) {
          return {
            status: 'received',
            result: { status: 'unavailable', reason: 'scope_unavailable' },
          }
        }
        try {
          const result = readBookmarkResult(
            await backend.execute({
              campaignId,
              operationId: envelope.operationId,
              command: {
                type: 'setBookmarkState',
                resourceIds: [...envelope.command.resourceIds],
                bookmarked: envelope.command.bookmarked,
              },
            }),
          )
          return { status: 'received', result }
        } catch {
          return { status: 'indeterminate', retryable: true, reason: 'response_lost' }
        }
      },
    },
    start: () => {
      if (unsubscribe) return
      unsubscribe = backend.watch((projection) => {
        let resourceIds: ReadonlyArray<ResourceId>
        try {
          resourceIds = readCoveredResourceIds(projection.resourceIds, projection.snapshot)
        } catch {
          return
        }
        if (applyProjection(projection.snapshot).status !== 'completed') return
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
      requireExactProjectionCoverage(
        projection.snapshot,
        new Set(results.map((result) => result.resourceId)),
      )
      if (applyProjection(projection.snapshot).status !== 'completed') {
        throw new TypeError('Invalid authorized search projection')
      }
      return results
    },
    recent: () => getLiveRecentResources(campaignId, actorId),
    subscribeRecent: (listener) => subscribeToLiveRecentResources(campaignId, actorId, listener),
    recordOpened: (id) => addLiveRecentResource(campaignId, actorId, id),
  }
}

function readBookmarkResult(result: BookmarkResult): ResourceBookmarkCommandResult {
  if (result.status !== 'completed') return result
  return {
    status: 'completed',
    receipt: {
      campaignId: assertDomainId(DOMAIN_ID_KIND.campaign, result.receipt.campaignId),
      operationId: assertDomainId(DOMAIN_ID_KIND.operation, result.receipt.operationId),
      resourceIds: result.receipt.resourceIds.map(resourceId),
      bookmarked: result.receipt.bookmarked,
    },
  }
}

function resourceId(value: string) {
  return assertDomainId(DOMAIN_ID_KIND.resource, value)
}

function readCoveredResourceIds(
  values: ReadonlyArray<string>,
  snapshot: StoredProjection,
): ReadonlyArray<ResourceId> {
  const resourceIds = values.map(resourceId)
  const targets = new Set(resourceIds)
  if (targets.size !== resourceIds.length) throw new TypeError('Duplicate projected resource')
  requireExactProjectionCoverage(snapshot, targets)
  return resourceIds
}

function readSearchResults(
  values: SearchProjection['results'],
): ReadonlyArray<WorkspaceSearchResult> {
  const results = values.map((result) => ({
    resourceId: resourceId(result.resourceId),
    match: result.match,
  }))
  if (new Set(results.map((result) => result.resourceId)).size !== results.length) {
    throw new TypeError('Duplicate search result')
  }
  return results
}

function requireExactProjectionCoverage(
  snapshot: StoredProjection,
  targets: ReadonlySet<ResourceId>,
): void {
  const resources = readProjectionResources(snapshot)
  const missing = readMissingProjectionResources(snapshot, resources, targets)
  const requiredResources = requiredProjectionResources(resources, missing, targets)
  if (resources.size !== requiredResources.size) {
    throw new TypeError('Projected resource coverage is not exact')
  }
}

type ProjectionResource = Readonly<{ displayParentId: ResourceId | null }>

function readProjectionResources(
  snapshot: StoredProjection,
): ReadonlyMap<ResourceId, ProjectionResource> {
  const resources = new Map<ResourceId, Readonly<{ displayParentId: ResourceId | null }>>()
  for (const source of snapshot.resources) {
    const id = resourceId(source.id)
    if (resources.has(id)) throw new TypeError('Duplicate projected resource')
    resources.set(id, {
      displayParentId: source.displayParentId === null ? null : resourceId(source.displayParentId),
    })
  }
  return resources
}

function readMissingProjectionResources(
  snapshot: StoredProjection,
  resources: ReadonlyMap<ResourceId, ProjectionResource>,
  targets: ReadonlySet<ResourceId>,
): ReadonlySet<ResourceId> {
  const missing = new Set<ResourceId>()
  for (const value of snapshot.missingResourceIds) {
    const id = resourceId(value)
    if (missing.has(id) || resources.has(id) || !targets.has(id)) {
      throw new TypeError('Invalid missing resource coverage')
    }
    missing.add(id)
  }
  return missing
}

function requiredProjectionResources(
  resources: ReadonlyMap<ResourceId, ProjectionResource>,
  missing: ReadonlySet<ResourceId>,
  targets: ReadonlySet<ResourceId>,
): ReadonlySet<ResourceId> {
  const requiredResources = new Set<ResourceId>()
  for (const target of targets) {
    if (missing.has(target)) continue
    let currentId: ResourceId | null = target
    const spine = new Set<ResourceId>()
    while (currentId !== null) {
      if (spine.has(currentId)) throw new TypeError('Projected resource spine contains a cycle')
      spine.add(currentId)
      requiredResources.add(currentId)
      const resource = resources.get(currentId)
      if (!resource) throw new TypeError('Projected resource coverage is incomplete')
      currentId = resource.displayParentId
    }
  }
  return requiredResources
}
