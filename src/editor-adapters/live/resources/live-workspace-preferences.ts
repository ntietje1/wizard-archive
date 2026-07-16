import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import { WorkspacePreferencesController } from '@wizard-archive/editor/resources/workspace-preferences'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'
import { ERROR_CODE, isClientError } from '../../../../shared/errors/client'

export function createLiveWorkspacePreferences(campaignId: CampaignId, convex: ConvexReactClient) {
  const controller = new WorkspacePreferencesController({
    save: (change) =>
      convex.mutation(api.workspacePreferences.mutations.change, { campaignId, change }),
  })
  let unsubscribe: (() => void) | null = null
  return {
    source: controller,
    start: () => {
      if (unsubscribe) return
      const watch = convex.watchQuery(api.workspacePreferences.queries.get, { campaignId })
      const apply = () => {
        try {
          const snapshot = watch.localQueryResult()
          if (snapshot !== undefined) controller.hydrate(snapshot)
        } catch (error) {
          controller.unavailable(
            isClientError(error, ERROR_CODE.NOT_AUTHENTICATED) ||
              isClientError(error, ERROR_CODE.PERMISSION_DENIED)
              ? 'unauthorized'
              : 'scope_unavailable',
          )
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
