import { PERMISSION_LEVEL } from 'convex/permissions/types'
import { createElement } from 'react'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { FilteredSidebarItemsContext } from '~/features/sidebar/contexts/filtered-sidebar-items-context'
import { useEditorMode } from '~/features/sidebar/hooks/useEditorMode'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

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
