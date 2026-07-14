import { useEffect } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { addLiveRecentItem } from '~/editor-adapters/live/live-recent-items'
import { useLiveWorkspaceSelectedResourceId } from './use-live-workspace-navigation'

export function LiveWorkspaceRouteEffects() {
  const requestedResourceId = useLiveWorkspaceSelectedResourceId()
  const { campaignId: workspaceRecordId } = useCampaign()

  useEffect(() => {
    if (requestedResourceId && workspaceRecordId) {
      addLiveRecentItem(workspaceRecordId, requestedResourceId)
    }
  }, [requestedResourceId, workspaceRecordId])

  return null
}
