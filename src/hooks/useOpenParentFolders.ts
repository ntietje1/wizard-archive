import { useCallback } from 'react'
import { useConvex } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useCampaign } from '~/contexts/CampaignContext'
import type { SidebarItemId } from 'convex/sidebarItems/types'

/**
 * Hook to open all parent folders for a given sidebar item.
 * This ensures the item is visible in the sidebar by expanding
 * all ancestor folders.
 */
//TODO: for "show in sidebar" operation, flash the item in the sidebar
export function useOpenParentFolders() {
  const { openFolder } = useFileSidebar()
  const { campaignWithMembership } = useCampaign()
  const convex = useConvex()

  const openParentFolders = useCallback(
    async (itemId: SidebarItemId) => {
      const campaignId = campaignWithMembership.data?.campaign._id
      if (!campaignId) return

      try {
        const ancestors = await convex.query(
          api.sidebarItems.queries.getSidebarItemAncestors,
          {
            campaignId,
            id: itemId,
          },
        )

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
