import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { collectDescendantIds } from '~/features/sidebar/utils/sidebar-item-maps'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'

export function permanentDeleteDescription(
  item: AnySidebarItem,
  allTrashedItems: Array<AnySidebarItem>,
): string {
  const descendantCount = isFolder(item) ? collectDescendantIds(item._id, allTrashedItems).size : 0
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
