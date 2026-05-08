import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

type SidebarChildMapItem = Pick<AnySidebarItem, '_id' | 'type'>

export async function collectSidebarChildrenMap<T extends SidebarChildMapItem>({
  rootFolderIds,
  getChildren,
  maxDepth,
  onDepthExceeded,
}: {
  rootFolderIds: Array<Id<'sidebarItems'>>
  getChildren: (parentId: Id<'sidebarItems'>) => Promise<Array<T>>
  maxDepth: number
  onDepthExceeded: () => never
}): Promise<Map<Id<'sidebarItems'>, Array<T>>> {
  const childrenMap = new Map<Id<'sidebarItems'>, Array<T>>()
  const pending = rootFolderIds.map((folderId) => ({ folderId, depth: 0 }))

  while (pending.length > 0) {
    const next = pending.shift()
    if (!next) break
    if (childrenMap.has(next.folderId)) continue
    if (next.depth >= maxDepth) onDepthExceeded()

    const children = await getChildren(next.folderId)
    childrenMap.set(next.folderId, children)
    for (const child of children) {
      if (child.type === SIDEBAR_ITEM_TYPES.folders) {
        pending.push({ folderId: child._id, depth: next.depth + 1 })
      }
    }
  }

  return childrenMap
}
