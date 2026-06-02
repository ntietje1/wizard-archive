import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { selectionBelongsToSurface } from 'shared/sidebar-items/filesystem/selection'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { resolveSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const activeItemSurface = useSidebarUIStore((s) => s.activeItemSurface)
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
  const belongsToActiveSurfaceSelection =
    activeItemSurface !== null &&
    activeItemSurface.visibleItemIds.includes(item._id) &&
    selectionBelongsToSurface(selectedItemIds, activeItemSurface.visibleItemIds)
  const belongsToSelection = belongsToActiveSurfaceSelection && selectedItemIds.includes(item._id)
  const itemIds = belongsToSelection
    ? resolveSidebarOperationItems({
        itemIds: selectedItemIds,
        activeItemsMap,
        trashedItemsMap: trashItemsMap,
      }).map((selectedItem) => selectedItem._id)
    : [item._id]
  const previewItemIds = belongsToSelection
    ? selectedItems.map((selectedItem) => selectedItem._id)
    : [item._id]

  return {
    sidebarItemId: item._id,
    sidebarItemIds: itemIds,
    sidebarDragPreviewItemIds: previewItemIds,
  }
}
