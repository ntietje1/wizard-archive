import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'

export const OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX = 'optimistic-' as const

export function isOptimisticSidebarItemId(
  itemId: Id<'sidebarItems'> | string | null | undefined,
): itemId is string {
  return typeof itemId === 'string' && itemId.startsWith(OPTIMISTIC_SIDEBAR_ITEM_ID_PREFIX)
}

export function isOptimisticSidebarItem(
  item: Pick<AnySidebarItem, '_id'> | null | undefined,
): item is Pick<AnySidebarItem, '_id'> {
  return isOptimisticSidebarItemId(item?._id)
}
