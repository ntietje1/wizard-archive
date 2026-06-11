import { SidebarItem } from './sidebar-item/sidebar-item'
import { sortItemsByOptions } from '~/features/sidebar/utils/sidebar-item-sort'
import { ScrollArea } from '~/features/shadcn/components/scroll-area'
import { buildVisibleSidebarItemIds } from '~/features/sidebar/utils/item-selection-order'
import { useItemSurfaceRegistration } from '~/features/sidebar/hooks/useItemSurfaceRegistration'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { Id } from 'convex/_generated/dataModel'

export function SidebarList() {
  const {
    filteredActiveItems: { parentItemsMap, status },
    ui: { closeAllFoldersMode, folderStates },
    sort: { options: sortOptions },
  } = useSidebarWorkspaceSource()

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
  const { activateSurface, handleSurfacePointerDown, itemSurfaceHotkeyProps } =
    useItemSurfaceRegistration({
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
      {...itemSurfaceHotkeyProps}
    >
      {rootItems.map((item) => (
        <SidebarItem
          key={item._id}
          item={item}
          parentItemsMap={parentItemsMap}
          sortOptions={sortOptions}
          visibleItemIds={visibleItemIds}
        />
      ))}
    </ScrollArea>
  )
}
