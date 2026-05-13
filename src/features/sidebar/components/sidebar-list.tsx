import { SidebarItem } from './sidebar-item/sidebar-item'
import {
  sortItemsByOptions,
  useFilteredSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import { useCampaignSidebarState } from '~/features/sidebar/stores/sidebar-ui-store'
import { buildVisibleSidebarItemIds } from '~/features/sidebar/utils/item-selection-order'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'
import type { Id } from 'convex/_generated/dataModel'

export function SidebarList() {
  const { parentItemsMap, status } = useFilteredSidebarItems()
  const { sortOptions } = useSortOptions()
  const { campaignId } = useCampaign()
  const { folderStates, closeAllFoldersMode } = useCampaignSidebarState(campaignId)

  const rootItems = sortItemsByOptions(sortOptions, parentItemsMap.get(null)) ?? []
  const expandedFolderIds = new Set<Id<'sidebarItems'>>()
  if (!closeAllFoldersMode) {
    for (const [id, isOpen] of Object.entries(folderStates)) {
      if (isOpen) expandedFolderIds.add(id as Id<'sidebarItems'>)
    }
  }
  const visibleItemIds = buildVisibleSidebarItemIds({
    parentItemsMap,
    expandedFolderIds,
    sortOptions,
  })
  const { activateSurface, handleSurfacePointerDown } = useItemSurfaceRegistration({
    surface: 'sidebar',
    parentId: null,
    visibleItemIds,
  })

  if (status !== 'success') {
    return null
  }

  return (
    <ScrollArea
      className="group/sidebar-surface flex-1 min-h-0 min-w-0 w-full p-1"
      onFocusCapture={activateSurface}
      onPointerDownCapture={handleSurfacePointerDown}
      onContextMenuCapture={activateSurface}
    >
      {rootItems.map((item) => (
        <SidebarItem
          key={item._id}
          item={item}
          parentItemsMap={parentItemsMap}
          visibleItemIds={visibleItemIds}
        />
      ))}
    </ScrollArea>
  )
}
