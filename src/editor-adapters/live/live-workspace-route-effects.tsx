import { useEffect } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { addLiveRecentItem } from '~/editor-adapters/live/live-recent-items'
import { useLiveWorkspaceSelectedSlug } from './use-live-workspace-navigation'

export function LiveWorkspaceRouteEffects() {
  const requestedSlug = useLiveWorkspaceSelectedSlug()
  const { campaignId: workspaceRecordId } = useCampaign()

  useEffect(() => {
    if (requestedSlug && workspaceRecordId) addLiveRecentItem(workspaceRecordId, requestedSlug)
  }, [requestedSlug, workspaceRecordId])

  return null
}
