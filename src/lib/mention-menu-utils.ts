import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'

/**
 * Build breadcrumb path from parentId chain
 * Traverses up the parent hierarchy to create a path like "Folder / Subfolder"
 */
export function buildBreadcrumbs(
  item: AnySidebarItem,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): string {
  const path: Array<string> = []
  let currentId = item.parentId

  while (currentId && itemsMap.has(currentId)) {
    const parent = itemsMap.get(currentId)!
    path.unshift(parent.name || defaultItemName(parent))
    currentId = parent.parentId
  }
  if (path.length > 0) {
    return path.join('/') + '/'
  }
  return ''
}
