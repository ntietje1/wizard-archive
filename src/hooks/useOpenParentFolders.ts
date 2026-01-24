import { useCallback } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useCampaign } from '~/hooks/useCampaign'


// TODO: for "show in sidebar" operation, flash the item in the sidebar
export function useOpenParentFolders() {
  const { openFolder } = useFileSidebar()
  const { campaignWithMembership } = useCampaign()
  const convex = useConvex()

  const openParentFolders = useCallback(
    async (itemId: SidebarItemId) => {
      const campaignId = campaignWithMembership.data?.campaign._id
      if (!campaignId) return

      try {
        const item = await convex.query(
          api.sidebarItems.queries.getSidebarItem,
          {
            campaignId,
            id: itemId,
          },
        )
        if (!item) return

        const ancestors = item.ancestors
        ancestors.forEach((ancestor) => {
          openFolder(ancestor._id)
        })
      } catch (error) {
        console.error('Failed to open parent folders:', error)
      }
    },
    [openFolder, campaignWithMembership, convex],
  )

  return { openParentFolders }
}
