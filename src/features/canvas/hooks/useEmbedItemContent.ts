import { api } from 'convex/_generated/api'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useAuthQuery } from '~/shared/hooks/useAuthQuery'

export function useEmbedItemContent(
  sidebarItemId: SidebarItemId | undefined,
  enabled: boolean,
) {
  const result = useAuthQuery(
    api.sidebarItems.queries.getSidebarItem,
    enabled && sidebarItemId ? { id: sidebarItemId } : 'skip',
  )
  return result.data // TODO: expose full result object, update all consumers
}
