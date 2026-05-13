import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import {
  useActiveSidebarItems,
  useTrashSidebarItems,
} from '~/features/sidebar/hooks/useSidebarItems'
import { normalizeFileSystemOperationItems } from '~/features/filesystem/normalizeFileSystemOperationItems'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const { itemsMap } = useActiveSidebarItems()
  const { itemsMap: trashedItemsMap } = useTrashSidebarItems()
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap])
  const selectedItems = selectedItemIds
    .map((id) => allItemsMap.get(id))
    .filter((selectedItem): selectedItem is AnySidebarItem => Boolean(selectedItem))
  const isDraggingSelection = selectedItemIds.includes(item._id)
  const itemIds = isDraggingSelection
    ? normalizeFileSystemOperationItems(selectedItems, allItemsMap).map(
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
