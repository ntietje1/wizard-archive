import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import { applyWorkspacePreferencePatch } from '@wizard-archive/editor/resources/workspace-preferences'
import type {
  WorkspacePreferencesSource,
  WorkspacePreferencesState,
} from '@wizard-archive/editor/resources/workspace-preferences'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE, isClientError } from '../../../../shared/errors/client'

export function createLiveWorkspacePreferences(campaignId: CampaignId, convex: ConvexReactClient) {
  let state: WorkspacePreferencesState = { status: 'loading' }
  const listeners = new Set<() => void>()
  let unsubscribe: (() => void) | null = null
  const publish = (next: WorkspacePreferencesState) => {
    state = next
    for (const listener of listeners) listener()
  }
  const source: WorkspacePreferencesSource = {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    patch: async (patch) => {
      await convex.mutation(
        api.workspacePreferences.mutations.patch,
        { campaignId, patch },
        {
          optimisticUpdate: (localStore, args) => {
            const queryArgs = { campaignId: args.campaignId }
            const current = localStore.getQuery(api.workspacePreferences.queries.get, queryArgs)
            if (current === undefined) return
            localStore.setQuery(
              api.workspacePreferences.queries.get,
              queryArgs,
              applyWorkspacePreferencePatch(current, args.patch),
            )
          },
        },
      )
    },
  }

  return {
    source,
    start: () => {
      if (unsubscribe) return
      const watch = convex.watchQuery(api.workspacePreferences.queries.get, { campaignId })
      const apply = () => {
        try {
          const value = watch.localQueryResult()
          if (value !== undefined) publish({ status: 'ready', value })
        } catch (error) {
          publish({
            status: 'unavailable',
            reason:
              isClientError(error, ERROR_CODE.NOT_AUTHENTICATED) ||
              isClientError(error, ERROR_CODE.PERMISSION_DENIED)
                ? 'unauthorized'
                : 'scope_unavailable',
          })
        }
      }
      unsubscribe = watch.onUpdate(apply)
      apply()
    },
    dispose: () => {
      unsubscribe?.()
      unsubscribe = null
    },
  }
}
