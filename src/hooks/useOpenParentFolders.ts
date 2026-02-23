import { useCallback } from 'react'
import type { SidebarItemId } from 'convex/sidebarItems/baseTypes'
import { useCampaign } from '~/hooks/useCampaign'
import { useCampaignSidebarActions } from '~/stores/sidebarUIStore'
import { useAllSidebarItems } from '~/hooks/useSidebarItems'

export function useOpenParentFolders() {
  const { campaignId } = useCampaign()
  const { setFolderState } = useCampaignSidebarActions(campaignId)
  const { getAncestorSidebarItems } = useAllSidebarItems()

  const openParentFolders = useCallback(
    (itemId: SidebarItemId) => {
      const ancestors = getAncestorSidebarItems(itemId)
      ancestors.forEach((ancestor) => {
        setFolderState(ancestor._id, true)
      })
    },
    [setFolderState, getAncestorSidebarItems],
  )

  return { openParentFolders }
}
