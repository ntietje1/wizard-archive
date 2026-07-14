import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import type { CampaignId } from '@wizard-archive/editor/resources/domain-id'

import { createWizardEditorRemoteDownloadSource } from '@wizard-archive/editor/adapter'
import type { WizardEditorRemoteDownloadSource } from '@wizard-archive/editor/adapter'

export function createLiveWorkspaceDownloadSource(
  convex: Pick<ConvexReactClient, 'query'>,
  workspaceId: CampaignId,
  { canDownloadRoot }: { canDownloadRoot: boolean },
): WizardEditorRemoteDownloadSource {
  return createWizardEditorRemoteDownloadSource({
    canDownloadRoot,
    unavailableRootReason: 'not_dm',
    loadItemsForDownload: async ({ itemIds }) =>
      convex.query(api.folders.queries.getSidebarItemsForDownload, {
        campaignId: workspaceId,
        sourceItemIds: [...itemIds],
      }),
    loadRootItemsForDownload: async () =>
      convex.query(api.folders.queries.getRootContentsForDownload, {
        campaignId: workspaceId,
      }),
  })
}
