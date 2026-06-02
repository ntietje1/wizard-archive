import { useQueryClient } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { SIDEBAR_ITEMS_VIEW } from './useSidebarItems'
import type { SidebarItemsView } from './useSidebarItems'
import { assertNever } from '~/shared/utils/utils'

export function useSidebarItemsCache() {
  const { campaignId } = useCampaign()
  const queryClient = useQueryClient()

  const getQueryKey = (view: SidebarItemsView) => {
    if (!campaignId) return null
    const query = (() => {
      switch (view) {
        case SIDEBAR_ITEMS_VIEW.active:
          return api.sidebarItems.queries.getActiveSidebarItems
        case SIDEBAR_ITEMS_VIEW.trash:
          return api.sidebarItems.queries.getTrashedSidebarItems
        default:
          return assertNever(view)
      }
    })()
    return convexQuery(query, {
      campaignId,
    }).queryKey
  }

  const update = (
    view: SidebarItemsView,
    updater: (prev: Array<AnySidebarItem>) => Array<AnySidebarItem>,
  ) => {
    const key = getQueryKey(view)
    if (!key) return
    queryClient.setQueryData<Array<AnySidebarItem>>(key, (prev) => (prev ? updater(prev) : prev))
  }

  const get = (view: SidebarItemsView): Array<AnySidebarItem> => {
    const key = getQueryKey(view)
    if (!key) return []
    return queryClient.getQueryData<Array<AnySidebarItem>>(key) ?? []
  }

  return { update, get }
}
