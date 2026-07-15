import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from 'convex/_generated/api'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import type {
  ResourceBookmarkGateway,
  WorkspaceSearch,
} from '@wizard-archive/editor/resources/editor-runtime-contract'
import type { ResourceBookmarkCommandResult } from '@wizard-archive/editor/resources/command-contract'
import {
  addLiveRecentResource,
  getLiveRecentResources,
  subscribeToLiveRecentResources,
} from '../live-recent-resources'

type BookmarkArgs = FunctionArgs<typeof api.resources.mutations.executeBookmarkCommand>
type BookmarkResult = FunctionReturnType<typeof api.resources.mutations.executeBookmarkCommand>

export function createLiveResourceBookmarks(
  campaignId: CampaignId,
  backend: Readonly<{
    execute(args: BookmarkArgs): Promise<BookmarkResult>
    watch(apply: (resourceIds: ReadonlyArray<string>) => void): () => void
  }>,
): Readonly<{ gateway: ResourceBookmarkGateway; dispose(): void }> {
  let snapshot:
    | Readonly<{ state: 'unknown' }>
    | Readonly<{ state: 'known'; value: ReadonlySet<ReturnType<typeof resourceId>> }> = {
    state: 'unknown',
  }
  const listeners = new Set<() => void>()
  const dispose = backend.watch((ids) => {
    snapshot = { state: 'known', value: new Set(ids.map(resourceId)) }
    for (const listener of listeners) listener()
  })
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
    dispose,
  }
}

export function createLiveWorkspaceSearch(
  campaignId: CampaignId,
  search: (
    args: FunctionArgs<typeof api.resources.queries.searchResources>,
  ) => Promise<FunctionReturnType<typeof api.resources.queries.searchResources>>,
): WorkspaceSearch {
  return {
    search: async (query) =>
      (await search({ campaignId, query })).map((result) => ({
        resourceId: resourceId(result.resourceId),
        match: result.match,
      })),
    recent: () => getLiveRecentResources(campaignId),
    subscribeRecent: (listener) => subscribeToLiveRecentResources(campaignId, listener),
    recordOpened: (id) => addLiveRecentResource(campaignId, id),
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
