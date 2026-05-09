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
    } else if (import.meta.env.DEV) {
      console.warn(`Context menu selection referenced missing sidebar item ${selectedId}`)
    }
  }

  return normalizeTopLevelSelectedItems(resolvedItems, allItemsMap)
}

export function resolveContextPrimaryItem({
  item,
  selectedItems,
}: {
  item?: AnySidebarItem
  selectedItems: Array<AnySidebarItem>
}): AnySidebarItem | undefined {
  return selectedItems[0] ?? item
}
