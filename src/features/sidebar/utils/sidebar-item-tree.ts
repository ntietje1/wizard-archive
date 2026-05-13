import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

type SidebarTreeItem = Pick<AnySidebarItem, '_id' | 'parentId' | 'type'>

function indexChildrenByParent(items: Array<SidebarTreeItem>) {
  const childrenByParent = new Map<Id<'sidebarItems'>, Array<SidebarTreeItem>>()
  for (const item of items) {
    if (!item.parentId) continue
    const siblings = childrenByParent.get(item.parentId)
    if (siblings) siblings.push(item)
    else childrenByParent.set(item.parentId, [item])
  }
  return childrenByParent
}

/**
 * Collects descendant item IDs for a folder using an iterative DFS.
 *
 * `folderId` is the folder root, `items` is indexed into `childrenByParent`, `stack` tracks
 * pending folders, and `result` contains every discovered descendant ID. `seenFolders` prevents
 * duplicate folder traversal, and a direct cycle back to `folderId` throws because a
 * SIDEBAR_ITEM_TYPES.folders row cannot be its own descendant. Returns a Set of descendant IDs.
 */
export function collectDescendantIdsFromSidebarItems(
  folderId: Id<'sidebarItems'>,
  items: Array<SidebarTreeItem>,
): Set<Id<'sidebarItems'>> {
  const childrenByParent = indexChildrenByParent(items)
  const result = new Set<Id<'sidebarItems'>>()
  const stack = [folderId]
  const seenFolders = new Set<Id<'sidebarItems'>>([folderId])

  while (stack.length > 0) {
    const parentId = stack.pop()!
    for (const child of childrenByParent.get(parentId) ?? []) {
      if (child._id === folderId) {
        throw new Error(`Folder ${child._id} appears as its own descendant`)
      }
      if (result.has(child._id)) continue
      result.add(child._id)
      if (child.type === SIDEBAR_ITEM_TYPES.folders && !seenFolders.has(child._id)) {
        seenFolders.add(child._id)
        stack.push(child._id)
      }
    }
  }

  return result
}
