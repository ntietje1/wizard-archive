import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { Folder } from 'convex/folders/types'
import { isFolder } from '~/features/sidebar/utils/sidebar-item-utils'

export interface SidebarItemMaps {
  itemsMap: Map<SidebarItemId, AnySidebarItem>
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  getAncestorSidebarItems: (itemId: SidebarItemId) => Array<Folder>
}

export function buildSidebarItemMaps(data: Array<AnySidebarItem>): SidebarItemMaps {
  const itemsMap = new Map<SidebarItemId, AnySidebarItem>()
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

  const getAncestorSidebarItems = (itemId: SidebarItemId): Array<Folder> => {
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
): Set<SidebarItemId> {
  const childrenByParent = new Map<Id<'sidebarItems'>, Array<AnySidebarItem>>()
  for (const item of items) {
    if (!item.parentId) continue
    const siblings = childrenByParent.get(item.parentId)
    if (siblings) {
      siblings.push(item)
    } else {
      childrenByParent.set(item.parentId, [item])
    }
  }

  const result = new Set<SidebarItemId>()
  const stack: Array<Id<'sidebarItems'>> = [folderId]
  while (stack.length > 0) {
    const currentId = stack.pop()!
    const children = childrenByParent.get(currentId)
    if (!children) continue
    for (const child of children) {
      if (result.has(child._id)) continue
      result.add(child._id)
      if (isFolder(child)) stack.push(child._id)
    }
  }

  return result
}
