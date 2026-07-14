import { api } from 'convex/_generated/api'
import type { ConvexReactClient } from 'convex/react'
import type { Id } from 'convex/_generated/dataModel'

import { createWizardEditorRemoteDownloadSource } from '@wizard-archive/editor/adapter'
import type { WizardEditorRemoteDownloadSource } from '@wizard-archive/editor/adapter'

export function createLiveWorkspaceDownloadSource(
  convex: Pick<ConvexReactClient, 'query'>,
  workspaceId: string,
  { canDownloadRoot }: { canDownloadRoot: boolean },
): WizardEditorRemoteDownloadSource {
  const workspaceRecordId = asLiveDownloadWorkspaceRecordId(workspaceId)

  return createWizardEditorRemoteDownloadSource({
    canDownloadRoot,
    unavailableRootReason: 'not_dm',
    loadItemsForDownload: async ({ itemIds }) =>
      convex.query(api.folders.queries.getSidebarItemsForDownload, {
        campaignId: workspaceRecordId,
        sourceItemIds: [...itemIds],
      }),
    loadRootItemsForDownload: async () =>
      convex.query(api.folders.queries.getRootContentsForDownload, {
        campaignId: workspaceRecordId,
      }),
  })
}

function asLiveDownloadWorkspaceRecordId(workspaceId: string) {
  return workspaceId as Id<'campaigns'>
}
