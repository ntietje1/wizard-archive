import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useSidebarItemById(sidebarItemId: SidebarItemId | undefined) {
  const result = useAuthQuery(
    api.sidebarItems.queries.getSidebarItem,
    sidebarItemId ? { id: sidebarItemId } : 'skip',
  )
  return { data: result.data, isLoading: result.isLoading, error: result.error }
}
