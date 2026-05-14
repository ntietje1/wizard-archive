import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'
import { collectDescendantIdsFromSidebarItems } from '~/features/sidebar/utils/sidebar-item-tree'

export interface SidebarItemMaps {
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  getAncestorSidebarItems: (itemId: Id<'sidebarItems'>) => Array<Folder>
}

export function buildSidebarItemMaps(data: Array<AnySidebarItem>): SidebarItemMaps {
  const itemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>()
  for (const item of data) {
    itemsMap.set(item._id, item)
  }

  const parentItemsMap = new Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>()
  for (const item of data) {
    const effectiveParentId = item.parentId && !itemsMap.has(item.parentId) ? null : item.parentId
    const siblings = parentItemsMap.get(effectiveParentId)
    if (siblings) {
      siblings.push(item)
    } else {
      parentItemsMap.set(effectiveParentId, [item])
    }
  }

  const getAncestorSidebarItems = (itemId: Id<'sidebarItems'>): Array<Folder> => {
    const item = itemsMap.get(itemId)
    if (!item) return []
    let currAncestorId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>()
    const ancestors: Array<Folder> = []
    while (currAncestorId && !seen.has(currAncestorId)) {
      seen.add(currAncestorId)
      const ancestor = itemsMap.get(currAncestorId)
      if (ancestor && isFolder(ancestor)) {
        ancestors.push(ancestor)
        currAncestorId = ancestor.parentId
      }
    }
    return ancestors
  }

  return { itemsMap, parentItemsMap, getAncestorSidebarItems }
}

/**
 * When both itemsMap and items are passed, callers must keep them in sync:
 * hasFolder checks itemsMap while collectDescendantIdsFromSidebarItems walks items.
 * A stale itemsMap can admit a folder id that is missing from items and produce
 * incorrect descendant collection.
 */
export function collectDescendantIds(
  folderId: Id<'sidebarItems'>,
  items: Array<AnySidebarItem>,
  itemsMap?: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
): Set<Id<'sidebarItems'>> {
  const hasFolder = itemsMap ? itemsMap.has(folderId) : items.some((item) => item._id === folderId)
  if (!hasFolder) return new Set()
  return collectDescendantIdsFromSidebarItems(folderId, items)
}
