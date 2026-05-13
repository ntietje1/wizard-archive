import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { EditorMenuContext } from './types'

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

  return resolvedItems
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

export function resolveRawContextItems(
  context: Pick<EditorMenuContext, 'item' | 'primaryItem' | 'selectedItems'>,
): Array<AnySidebarItem> {
  if (context.selectedItems && context.selectedItems.length > 0) {
    const clickedItem = context.primaryItem ?? context.item
    if (clickedItem && !context.selectedItems.some((item) => item._id === clickedItem._id)) {
      return [clickedItem]
    }
    return context.selectedItems
  }
  const item = context.primaryItem ?? context.item
  return item ? [item] : []
}
