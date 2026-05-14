import { PERMISSION_LEVEL } from 'convex/permissions/types'
import type { SidebarItemsValue } from './useSidebarItems'
import { useActiveSidebarItems } from './useSidebarItems'
import { useEditorMode } from './useEditorMode'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { effectiveHasAtLeastPermission } from '~/features/sharing/utils/permission-utils'
import { buildSidebarItemMaps } from '~/features/sidebar/utils/sidebar-item-maps'

export const useFilteredSidebarItems = (): SidebarItemsValue => {
  const { isDm } = useCampaign()
  const { viewAsPlayerId } = useEditorMode()
  const allItems = useActiveSidebarItems()

  const permOpts = { isDm, viewAsPlayerId, allItemsMap: allItems.itemsMap }
  const filteredData = allItems.data.filter((item) =>
    effectiveHasAtLeastPermission(item, PERMISSION_LEVEL.VIEW, permOpts),
  )

  return {
    data: filteredData,
    status: allItems.status,
    ...buildSidebarItemMaps(filteredData),
  }
}
