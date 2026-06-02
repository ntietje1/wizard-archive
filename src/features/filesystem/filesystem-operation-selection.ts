import { normalizeSelectedRoots } from 'shared/sidebar-items/filesystem/selection'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

type SidebarItemMap = ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>

function combinedItemMap(activeItemsMap: SidebarItemMap, trashedItemsMap: SidebarItemMap) {
  return new Map<Id<'sidebarItems'>, AnySidebarItem>([...trashedItemsMap, ...activeItemsMap])
}

function resolveItems(
  itemIds: ReadonlyArray<Id<'sidebarItems'>>,
  allItemsMap: SidebarItemMap,
): Array<AnySidebarItem> {
  return itemIds
    .map((itemId) => allItemsMap.get(itemId))
    .filter((item): item is AnySidebarItem => item !== undefined)
}

export function resolveSidebarOperationItems({
  itemIds,
  activeItemsMap,
  trashedItemsMap = new Map(),
  excludeItemIds = [],
  includeTrashed = true,
}: {
  itemIds: ReadonlyArray<Id<'sidebarItems'>>
  activeItemsMap: SidebarItemMap
  trashedItemsMap?: SidebarItemMap
  excludeItemIds?: ReadonlyArray<Id<'sidebarItems'>>
  includeTrashed?: boolean
}): Array<AnySidebarItem> {
  const allItemsMap = combinedItemMap(activeItemsMap, trashedItemsMap)
  const excluded = new Set(excludeItemIds)
  const items = resolveItems(
    itemIds.filter((itemId) => !excluded.has(itemId)),
    allItemsMap,
  )
  return normalizeSelectedRoots(
    items.filter((item) => includeTrashed || !item.isTrashed),
    allItemsMap,
  )
}

export function resolveClickedSidebarOperationItems({
  item,
  selectedItemIds,
  activeItemsMap,
  trashedItemsMap,
  canUseItemSelection,
}: {
  item?: AnySidebarItem
  selectedItemIds: ReadonlyArray<Id<'sidebarItems'>>
  activeItemsMap: SidebarItemMap
  trashedItemsMap: SidebarItemMap
  canUseItemSelection: boolean
}): Array<AnySidebarItem> {
  const allItemsMap = combinedItemMap(activeItemsMap, trashedItemsMap)
  if (item) allItemsMap.set(item._id, item)

  if (!canUseItemSelection || !item || !selectedItemIds.includes(item._id)) {
    if (!item) return []
    return normalizeSelectedRoots([item], allItemsMap)
  }

  return normalizeSelectedRoots(resolveItems(selectedItemIds, allItemsMap), allItemsMap)
}
