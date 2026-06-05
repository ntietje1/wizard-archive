import { useEffect } from 'react'
import { resolveCampaignActor } from 'shared/campaigns/actor'
import { useCampaignMembers } from '~/features/campaigns/hooks/useCampaignMembers'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'

export function useCampaignActor() {
  const { campaignId, isDm } = useCampaign()
  const membersQuery = useCampaignMembers()
  const viewAsPlayer = useSidebarUIStore((state) => state.viewAsPlayer)
  const setViewAsPlayer = useSidebarUIStore((state) => state.setViewAsPlayer)
  const actor = resolveCampaignActor({
    campaignId,
    isDm,
    viewAsPlayer,
    members: membersQuery.data,
  })

  const shouldClearViewAs =
    viewAsPlayer !== null &&
    campaignId !== undefined &&
    (viewAsPlayer.campaignId !== campaignId ||
      (membersQuery.data !== undefined && actor?.kind !== 'dm_view_as'))

  useEffect(() => {
    if (shouldClearViewAs) {
      setViewAsPlayer(null)
    }
  }, [setViewAsPlayer, shouldClearViewAs])

  return actor
}
