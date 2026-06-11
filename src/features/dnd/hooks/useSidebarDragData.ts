import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import { selectionBelongsToSurface } from 'shared/sidebar-items/filesystem/selection'
import { resolveSidebarOperationItems } from '~/features/filesystem/filesystem-operation-selection'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

export function useSidebarDragData(item: AnySidebarItem) {
  const {
    items,
    selection: { activeItemSurface, selectedItemIds },
  } = useSidebarWorkspaceSource()
  const activeItemsMap = new Map(items.active.itemsMap)
  const trashItemsMap = new Map(items.trash.itemsMap)
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
