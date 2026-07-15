import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId, CampaignMemberId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceBookmarkGateway,
  WorkspaceSearch,
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
type StoredProjection = FunctionReturnType<typeof api.resources.queries.loadResource>
type BookmarkProjection = Readonly<{
  resourceIds: ReadonlyArray<string>
  snapshot: StoredProjection
}>
type SearchProjection = Readonly<{
  results: ReadonlyArray<
    Readonly<{
      resourceId: string
      match: Readonly<{ type: 'title' }> | Readonly<{ type: 'body'; text: string }>
    }>
  >
  snapshot: StoredProjection
}>
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
        if (applyProjection(projection.snapshot).status !== 'completed') return
        snapshot = { state: 'known', value: new Set(projection.resourceIds.map(resourceId)) }
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
      if (applyProjection(projection.snapshot).status !== 'completed') {
        throw new TypeError('Invalid authorized search projection')
      }
      return projection.results.map((result) => ({
        resourceId: resourceId(result.resourceId),
        match: result.match,
      }))
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
