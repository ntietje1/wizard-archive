import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import { useNavigateOnSlugChange } from './useNavigateOnSlugChange'
import { useSidebarItemMutations } from './useSidebarItemMutations'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import { useCampaign } from '~/hooks/useCampaign'

export function useRenameItem() {
  const { rename: collectionRename } = useSidebarItemMutations()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const { navigateIfSlugChanged } = useNavigateOnSlugChange()
  const queryClient = useQueryClient()

  const rename = useCallback(
    async (item: AnySidebarItem, newName: string) => {
      if (!item || !campaignId) return

      const previousSlug = item.slug

      try {
        // Optimistic update via collection (validates before applying)
        const tx = collectionRename(item, newName)
        if (!tx) return

        // Wait for server confirmation to get the new slug
        await tx.isPersisted.promise

        // After server confirms, refetch the slug-based query to get the actual slug
        const updatedBySlugData = queryClient.getQueryData(
          convexQuery(api.sidebarItems.queries.getSidebarItemBySlug, {
            campaignId,
            type: item.type,
            slug: previousSlug,
          }).queryKey,
        ) as AnySidebarItem | null | undefined

        // The collection refetch will bring in the server-confirmed data
        // but we also need to handle URL navigation if the slug changed
        if (updatedBySlugData && updatedBySlugData.slug !== previousSlug) {
          navigateIfSlugChanged({
            itemId: item._id,
            itemType: item.type,
            previousSlug,
            newSlug: updatedBySlugData.slug,
            updatedItem: updatedBySlugData,
          })
        }
      } catch (error) {
        console.error(error)
        throw error
      }
    },
    [campaignId, collectionRename, navigateIfSlugChanged, queryClient],
  )

  return {
    rename,
  }
}
