const OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX = 'optimistic-'

export function isOptimisticSidebarItemId(itemId: string | null | undefined): itemId is string {
  return typeof itemId === 'string' && itemId.startsWith(OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX)
}

export function isOptimisticSidebarItem<Item extends { id: string }>(
  item: Item | null | undefined,
): item is Item {
  return isOptimisticSidebarItemId(item?.id)
}
