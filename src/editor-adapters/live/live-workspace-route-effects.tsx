import { useEffect } from 'react'
import type { ResourceIndexLoader } from '@wizard-archive/editor/resources/index-contract'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { addLiveRecentResource } from '~/editor-adapters/live/live-recent-resources'
import { useLiveWorkspaceSelectedResourceId } from './use-live-workspace-navigation'

export function LiveWorkspaceRouteEffects({
  resourceLoader,
}: {
  resourceLoader: ResourceIndexLoader
}) {
  const requestedResourceId = useLiveWorkspaceSelectedResourceId()
  const { campaignId: workspaceRecordId } = useCampaign()

  useEffect(() => {
    if (requestedResourceId && workspaceRecordId) {
      addLiveRecentResource(workspaceRecordId, requestedResourceId)
      void resourceLoader.ensureResource(requestedResourceId)
    }
  }, [requestedResourceId, resourceLoader, workspaceRecordId])

  return null
}
