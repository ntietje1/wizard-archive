import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { isOptimisticSidebarItemId } from '~/features/filesystem/optimistic-sidebar-items'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

export function useSidebarItemById(sidebarItemId: Id<'sidebarItems'> | null | undefined) {
  const queryArgs =
    sidebarItemId && !isOptimisticSidebarItemId(sidebarItemId) ? { id: sidebarItemId } : 'skip'
  const result = useCampaignQuery(api.sidebarItems.queries.getSidebarItem, queryArgs)
  return { data: result.data, isLoading: result.isLoading, error: result.error }
}
