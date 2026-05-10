import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemSlug } from 'convex/sidebarItems/validation/slug'

export function resolveItemsById(
  ids: Array<Id<'sidebarItems'>>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
) {
  const resolvedItems: Array<AnySidebarItem> = []
  for (const id of ids) {
    const item = allItemsMap.get(id)
    if (item) resolvedItems.push(item)
  }
  return resolvedItems
}

function isItemOrDescendantOfDeletedRoot(
  item: AnySidebarItem,
  deletedIds: ReadonlySet<Id<'sidebarItems'>>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
) {
  if (deletedIds.has(item._id)) return true
  let parentId = item.parentId
  const seen = new Set<Id<'sidebarItems'>>([item._id])
  while (parentId && !seen.has(parentId)) {
    if (deletedIds.has(parentId)) return true
    seen.add(parentId)
    parentId = allItemsMap.get(parentId)?.parentId ?? null
  }
  return false
}

/**
 * Filters selected IDs after deleting root items.
 * Uses selectedItemIds as the current selection, rootItems as deleted roots, and
 * allItemsMap to detect descendants via isItemOrDescendantOfDeletedRoot.
 */
export function removeItemsUnderRootsFromSelection({
  selectedItemIds,
  rootItems,
  allItemsMap,
}: {
  selectedItemIds: Array<Id<'sidebarItems'>>
  rootItems: Array<AnySidebarItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
}) {
  const deletedIds = new Set(rootItems.map((item) => item._id))
  return selectedItemIds.filter((selectedId) => {
    const selectedItem = allItemsMap.get(selectedId)
    return selectedItem
      ? !isItemOrDescendantOfDeletedRoot(selectedItem, deletedIds, allItemsMap)
      : false
  })
}

export function shouldClearEditorForDeletedRoots({
  deletedItems,
  currentSlug,
  itemBySlug,
  allItemsMap,
}: {
  deletedItems: Array<AnySidebarItem>
  currentSlug: SidebarItemSlug | null
  itemBySlug: ReadonlyMap<SidebarItemSlug, AnySidebarItem>
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
}) {
  if (!currentSlug) return false
  const currentItem = itemBySlug.get(currentSlug)
  if (!currentItem) return false
  const deletedIds = new Set(deletedItems.map((item) => item._id))
  return isItemOrDescendantOfDeletedRoot(currentItem, deletedIds, allItemsMap)
}
