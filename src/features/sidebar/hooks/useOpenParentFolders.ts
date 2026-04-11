import type { Id } from 'convex/_generated/dataModel'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignSidebarActions } from '~/features/sidebar/stores/sidebar-ui-store'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

export function useOpenParentFolders() {
  const { campaignId } = useCampaign()
  const { setFolderState } = useCampaignSidebarActions(campaignId)
  const { getAncestorSidebarItems } = useActiveSidebarItems()

  const openParentFolders = (itemId: Id<'sidebarItems'>) => {
    const ancestors = getAncestorSidebarItems(itemId)
    ancestors.forEach((ancestor) => {
      setFolderState(ancestor._id, true)
    })
  }

  return { openParentFolders }
}
