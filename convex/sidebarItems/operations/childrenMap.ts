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
  const enqueuedFolders = new Set(rootFolderIds)

  while (pending.length > 0) {
    const batch = pending.splice(0, pending.length).filter((next) => {
      if (childrenMap.has(next.folderId)) return false
      // Depth is exclusive: roots are depth 0, so maxDepth=2 processes depths 0 and 1.
      if (next.depth >= maxDepth) onDepthExceeded()
      return true
    })

    const childrenByFolder = await Promise.all(
      batch.map(async (next) => ({
        ...next,
        children: await getChildren(next.folderId),
      })),
    )

    for (const { folderId, depth, children } of childrenByFolder) {
      childrenMap.set(folderId, children)
      for (const child of children) {
        if (child.type !== SIDEBAR_ITEM_TYPES.folders || enqueuedFolders.has(child._id)) continue
        enqueuedFolders.add(child._id)
        pending.push({ folderId: child._id, depth: depth + 1 })
      }
    }
  }

  return childrenMap
}
