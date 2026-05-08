import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

type SidebarTreeItem = Pick<AnySidebarItem, '_id' | 'parentId' | 'type'>

function indexChildrenByParent(items: Array<SidebarTreeItem>) {
  const childrenByParent = new Map<Id<'sidebarItems'>, Array<SidebarTreeItem>>()
  for (const item of items) {
    if (!item.parentId) continue
    const siblings = childrenByParent.get(item.parentId)
    if (siblings) {
      siblings.push(item)
    } else {
      childrenByParent.set(item.parentId, [item])
    }
  }
  return childrenByParent
}

function addChildDescendant(
  child: SidebarTreeItem,
  rootFolderId: Id<'sidebarItems'>,
  descendants: Set<Id<'sidebarItems'>>,
  stack: Array<{ id: Id<'sidebarItems'>; depth: number }>,
  depth: number,
) {
  if (child._id === rootFolderId) {
    throw new Error(`Cycle detected while collecting descendants for ${rootFolderId}`)
  }
  if (descendants.has(child._id)) return

  descendants.add(child._id)
  if (child.type === SIDEBAR_ITEM_TYPES.folders) {
    stack.push({ id: child._id, depth })
  }
}

export function collectDescendantIdsFromItems(
  folderId: Id<'sidebarItems'>,
  items: Array<SidebarTreeItem>,
  { maxDepth = 50 }: { maxDepth?: number } = {},
): Set<Id<'sidebarItems'>> {
  const childrenByParent = indexChildrenByParent(items)

  const result = new Set<Id<'sidebarItems'>>()
  const stack: Array<{ id: Id<'sidebarItems'>; depth: number }> = [{ id: folderId, depth: 0 }]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.depth >= maxDepth) {
      throw new Error(`Max sidebar tree depth exceeded at ${current.id}`)
    }

    const children = childrenByParent.get(current.id)
    if (!children) continue

    for (const child of children) {
      addChildDescendant(child, folderId, result, stack, current.depth + 1)
    }
  }

  return result
}
