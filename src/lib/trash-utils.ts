import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { getDescendantCount } from '~/hooks/useSidebarItems'
import { isFolder } from '~/lib/sidebar-item-utils'

/**
 * Builds the confirmation description for permanently deleting a single item.
 */
export function permanentDeleteDescription(
  item: AnySidebarItem,
  trashedParentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>,
): string {
  const descendantCount = isFolder(item)
    ? getDescendantCount(item._id, trashedParentItemsMap)
    : 0
  const base = `Are you sure you want to permanently delete "${item.name}"?`
  const detail =
    descendantCount > 0
      ? ` This will also delete ${descendantCount} ${descendantCount === 1 ? 'item' : 'items'} inside it.`
      : ''
  return `${base}${detail} This action cannot be undone.`
}

/**
 * Builds the confirmation description for emptying the entire trash.
 */
export function emptyTrashDescription(count: number): string {
  return `Are you sure you want to permanently delete ${count === 1 ? '1 item' : `all ${count} items`} in the trash? This action cannot be undone.`
}
