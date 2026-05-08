import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import { useMemo } from 'react'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'
import { normalizeTopLevelSelectedItems } from '~/features/sidebar/utils/item-selection-normalization'

export function useSidebarDragData(item: AnySidebarItem) {
  const selectedItemIds = useSidebarUIStore((s) => s.selectedItemIds)
  const { itemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.sidebar)
  const { itemsMap: trashedItemsMap } = useSidebarItems(SIDEBAR_ITEM_LOCATION.trash)
  const allItemsMap = useMemo(
    () => new Map<Id<'sidebarItems'>, AnySidebarItem>([...itemsMap, ...trashedItemsMap]),
    [itemsMap, trashedItemsMap],
  )
  const selectedItems = useMemo(
    () =>
      selectedItemIds
        .map((id) => allItemsMap.get(id))
        .filter((selectedItem): selectedItem is AnySidebarItem => Boolean(selectedItem)),
    [allItemsMap, selectedItemIds],
  )
  const itemIds = useMemo(
    () =>
      selectedItemIds.includes(item._id)
        ? normalizeTopLevelSelectedItems(selectedItems, allItemsMap).map(
            (selectedItem) => selectedItem._id,
          )
        : [item._id],
    [allItemsMap, item._id, selectedItemIds, selectedItems],
  )

  return {
    sidebarItemId: item._id,
    sidebarItemIds: itemIds,
  }
}
