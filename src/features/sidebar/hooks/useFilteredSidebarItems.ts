import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { createContext, createElement, useContext } from 'react'
import type { SidebarItemsValue } from './useSidebarItems'
import { useActiveSidebarItems } from './useSidebarItems'
import { useEditorMode } from './useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

const FilteredSidebarItemsContext = createContext<SidebarItemsValue | null>(null)

export function FilteredSidebarItemsProvider({ children }: { children: React.ReactNode }) {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const allItems = useActiveSidebarItems()

  if (isDm && !viewAsPlayerId) {
    return createElement(FilteredSidebarItemsContext.Provider, { value: allItems }, children)
  }

  const permOpts = { isDm, viewAsPlayerId, allItemsMap: allItems.itemsMap }
  const filteredData = allItems.data.filter((item) =>
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )

  return createElement(
    FilteredSidebarItemsContext.Provider,
    {
      value: {
        data: filteredData,
        status: allItems.status,
        ...buildSidebarItemMaps(filteredData),
      },
    },
    children,
  )
}

export const useFilteredSidebarItems = (): SidebarItemsValue => {
  const ctx = useContext(FilteredSidebarItemsContext)
  if (!ctx) {
    throw new Error('useFilteredSidebarItems must be used within a FilteredSidebarItemsProvider')
  }
  return ctx
}
