import { api } from 'convex/_generated/api'
import type { Id } from 'convex/_generated/dataModel'
import { useCampaignQuery } from '~/shared/hooks/useCampaignQuery'

export function useSidebarItemById(sidebarItemId: Id<'sidebarItems'> | undefined) {
  const result = useCampaignQuery(
    api.sidebarItems.queries.getSidebarItem,
    sidebarItemId ? { id: sidebarItemId } : 'skip',
  )
  return { data: result.data, isLoading: result.isLoading, error: result.error }
}
