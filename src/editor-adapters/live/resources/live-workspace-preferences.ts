import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import { WorkspacePreferencesController } from '@wizard-archive/editor/resources/workspace-preferences'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

export function createLiveWorkspacePreferences(campaignId: CampaignId, convex: ConvexReactClient) {
  const controller = new WorkspacePreferencesController({
    save: (change) =>
      convex.mutation(api.workspacePreferences.mutations.change, { campaignId, change }),
  })
  const watch = convex.watchQuery(api.workspacePreferences.queries.get, { campaignId })
  const apply = () => {
    const snapshot = watch.localQueryResult()
    if (snapshot !== undefined) controller.hydrate(snapshot)
  }
  const unsubscribe = watch.onUpdate(apply)
  apply()
  return { source: controller, dispose: unsubscribe }
}
