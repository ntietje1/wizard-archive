import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { collectDescendantIdsFromItems } from 'convex/sidebarItems/operations/tree'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'

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

export function collectDescendantIds(
  folderId: Id<'sidebarItems'>,
  items: Array<AnySidebarItem>,
  itemsMap?: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
): Set<Id<'sidebarItems'>> {
  const hasFolder = itemsMap ? itemsMap.has(folderId) : items.some((item) => item._id === folderId)
  if (!hasFolder) return new Set()
  return collectDescendantIdsFromItems(folderId, items)
}
