import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const { itemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])
  const selectedItems: Array<AnySidebarItem> = []
  let hasCompleteSelection = true
  for (const id of selectedItemIds) {
    const selectedItem = allItemsMap.get(id)
    if (!selectedItem) {
      hasCompleteSelection = false
      break
    }
    selectedItems.push(selectedItem)
  }
  const belongsToSelection = selectedItemIds.includes(item._id)
  const isDraggingSelection = hasCompleteSelection && belongsToSelection
  const hasStaleSelection = belongsToSelection && !hasCompleteSelection
  const itemIds = hasStaleSelection
    ? []
    : isDraggingSelection
      ? normalizeSelectedRoots(selectedItems, allItemsMap).map((selectedItem) => selectedItem._id)
      : [item._id]
  const previewItemIds = hasStaleSelection
    ? []
    : isDraggingSelection
      ? selectedItems.map((selectedItem) => selectedItem._id)
      : [item._id]

  return {
    sidebarItemId: item._id,
    sidebarItemIds: itemIds,
    sidebarDragPreviewItemIds: previewItemIds,
  }
}
