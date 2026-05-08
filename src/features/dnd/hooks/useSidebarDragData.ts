import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { normalizeTopLevelSelectedItems } from 'convex/sidebarItems/operations/selection'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const { itemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])
  const selectedItems = selectedItemIds
    .map((id) => allItemsMap.get(id))
    .filter((selectedItem): selectedItem is AnySidebarItem => Boolean(selectedItem))
  const isDraggingSelection = selectedItemIds.includes(item._id)
  const itemIds = isDraggingSelection
    ? normalizeTopLevelSelectedItems(selectedItems, allItemsMap).map(
        (selectedItem) => selectedItem._id,
      )
    : [item._id]
  const previewItemIds = isDraggingSelection
    ? selectedItems.map((selectedItem) => selectedItem._id)
    : [item._id]

  return {
    sidebarItemId: item._id,
    sidebarItemIds: itemIds,
    sidebarDragPreviewItemIds: previewItemIds,
  }
}
