import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'

function resolveSelectedItemsById({
  selectedItemIds,
  allItemsMap,
}: {
  selectedItemIds: Array<Id<'sidebarItems'>>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
}): Array<AnySidebarItem> | null {
  const items: Array<AnySidebarItem> = []
  for (const selectedItemId of selectedItemIds) {
    const item = allItemsMap.get(selectedItemId)
    if (!item) {
      return null
    }
    items.push(item)
  }
  return items
}

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
  const allItemsMap = new Map([...activeItemsMap, ...trashedItemsMap])
  if (!canUseItemSelection || !item || !selectedItemIds.includes(item._id)) {
    return item ? normalizeSelectedRoots([item], allItemsMap) : []
  }

  const selectedItems = resolveSelectedItemsById({ selectedItemIds, allItemsMap })
  return selectedItems ? normalizeSelectedRoots(selectedItems, allItemsMap) : []
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
