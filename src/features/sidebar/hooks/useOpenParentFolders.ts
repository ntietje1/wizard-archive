import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignSidebarActions } from '~/features/sidebar/stores/sidebar-ui-store'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

export function useOpenParentFolders() {
  const { campaignId } = useCampaign()
  const { setFolderState } = useCampaignSidebarActions(campaignId)
  const { getAncestorSidebarItems } = useAllSidebarItems()

  const openParentFolders = (itemId: SidebarItemId) => {
    const ancestors = getAncestorSidebarItems(itemId)
    ancestors.forEach((ancestor) => {
      setFolderState(ancestor._id, true)
    })
  }

  return { openParentFolders }
}
