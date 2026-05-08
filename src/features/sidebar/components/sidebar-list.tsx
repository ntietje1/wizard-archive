import { SidebarItem } from './sidebar-item/sidebar-item'
import {
  sortItemsByOptions,
  useFilteredSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarState,
  useSidebarUIStore,
} from '~/features/sidebar/stores/sidebar-ui-store'
import { buildVisibleSidebarItemIds } from '~/features/sidebar/utils/item-selection-order'
import { isItemSurfaceInteractionTarget } from '~/features/sidebar/utils/item-surface-hotkeys'
import type { Id } from 'convex/_generated/dataModel'
import { useMemo } from 'react'
import type { PointerEvent } from 'react'

export function SidebarList() {
  const { parentItemsMap, status } = useFilteredSidebarItems()
  const { sortOptions } = useSortOptions()
  const { campaignId } = useCampaign()
  const { folderStates, closeAllFoldersMode } = useCampaignSidebarState(campaignId)

  const rootItems = sortItemsByOptions(sortOptions, parentItemsMap.get(null)) ?? []
  const expandedFolderIds = useMemo(() => {
    if (closeAllFoldersMode) {
      return new Set<Id<'sidebarItems'>>()
    }

    const expandedIds: Array<Id<'sidebarItems'>> = []
    for (const [id, isOpen] of Object.entries(folderStates)) {
      if (isOpen) expandedIds.push(id as Id<'sidebarItems'>)
    }
    return new Set(expandedIds)
  }, [closeAllFoldersMode, folderStates])
  const visibleItemIds = useMemo(
    () =>
      buildVisibleSidebarItemIds({
        parentItemsMap,
        expandedFolderIds,
        sortOptions,
      }),
    [expandedFolderIds, parentItemsMap, sortOptions],
  )
  const setActiveItemSurface = useSidebarUIStore((s) => s.setActiveItemSurface)
  const clearItemSelection = useSidebarUIStore((s) => s.clearItemSelection)

  const activateSidebarSurface = () => {
    setActiveItemSurface({ surface: 'sidebar', parentId: null, visibleItemIds })
  }

  const handleSurfacePointerDown = (event: PointerEvent) => {
    activateSidebarSurface()
    if (!isItemSurfaceInteractionTarget(event.target)) {
      clearItemSelection()
    }
  }

  if (status !== 'success') {
    return null
  }

  return (
    <ScrollArea
      className="flex-1 min-h-0 min-w-0 w-full p-1"
      onFocusCapture={activateSidebarSurface}
      onPointerDownCapture={handleSurfacePointerDown}
      onContextMenuCapture={activateSidebarSurface}
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
