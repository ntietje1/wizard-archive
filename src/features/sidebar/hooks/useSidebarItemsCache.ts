import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemLocation } from 'convex/sidebarItems/types/baseTypes'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'

export function useSidebarItemsCache() {
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()

  const getQueryKey = (location: SidebarItemLocation) => {
    if (!campaignId) return null
    return convexQuery(api.sidebarItems.queries.getSidebarItemsByLocation, {
      campaignId,
      location,
    }).queryKey
  }

  const update = (
    location: SidebarItemLocation,
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    const key = getQueryKey(location)
    if (!key) return
    queryClient.setQueryData<Array<AnySidebarItem>>(key, (prev) =>
      prev ? updater(prev) : prev,
    )
  }

  const get = (location: SidebarItemLocation): Array<AnySidebarItem> => {
    const key = getQueryKey(location)
    if (!key) return []
    return queryClient.getQueryData<Array<AnySidebarItem>>(key) ?? []
  }

  return { update, get }
}
