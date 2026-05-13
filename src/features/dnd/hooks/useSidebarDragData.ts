import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { resolveSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const { itemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const activeItemsMap = new Map(itemsMap)
  const trashItemsMap = new Map(trashedItemsMap)
  if (item.isTrashed) {
    trashItemsMap.set(item._id, item)
  } else {
    activeItemsMap.set(item._id, item)
  }
  const allItemsMap = new Map([...activeItemsMap, ...trashItemsMap])
  const selectedItems = selectedItemIds.flatMap((id) => {
    const selectedItem = allItemsMap.get(id)
    return selectedItem ? [selectedItem] : []
  })
  const belongsToSelection = selectedItemIds.includes(item._id)
  const isDraggingSelection = belongsToSelection
  const itemIds = isDraggingSelection
    ? resolveSidebarOperationItems({
        itemIds: selectedItemIds,
        activeItemsMap,
        trashedItemsMap: trashItemsMap,
      }).map((selectedItem) => selectedItem._id)
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
