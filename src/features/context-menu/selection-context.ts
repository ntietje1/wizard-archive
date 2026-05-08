import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { normalizeTopLevelSelectedItems } from 'convex/sidebarItems/operations/selection'

export function resolveContextSelectedItems({
  item,
  selectedItemIds,
  activeItemsMap,
  trashedItemsMap,
  canUseItemSelection,
}: {
  item?: AnySidebarItem
  selectedItemIds: Array<Id<'sidebarItems'>>
  activeItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashedItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  canUseItemSelection: boolean
}): Array<AnySidebarItem> {
  const allItemsMap = new Map([...trashedItemsMap, ...activeItemsMap])
  if (!canUseItemSelection || !item || !selectedItemIds.includes(item._id)) {
    return item ? [item] : []
  }

  const resolvedItems: Array<AnySidebarItem> = []
  for (const selectedId of selectedItemIds) {
    const selectedItem = allItemsMap.get(selectedId) ?? (selectedId === item._id ? item : undefined)
    if (selectedItem) {
      resolvedItems.push(selectedItem)
    }
  }

  return normalizeTopLevelSelectedItems(resolvedItems, allItemsMap)
}
