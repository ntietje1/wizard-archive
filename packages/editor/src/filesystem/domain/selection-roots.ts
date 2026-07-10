import type { ResourceId } from '../../workspace/resource-contract'
import { MAX_SIDEBAR_TREE_DEPTH } from './tree'

type ResourceTreeNode = {
  id: ResourceId
  parentId: ResourceId | null
}

export function normalizeSelectedRoots<T extends ResourceTreeNode>(
  items: Array<T>,
  allItemsMap: ReadonlyMap<ResourceId, ResourceTreeNode>,
): Array<T> {
  const selectedIds = new Set(items.map((item) => item.id))
  const normalizedIds = new Set<ResourceId>()

  return items.filter((item) => {
    if (normalizedIds.has(item.id)) return false

    let parentId = item.parentId
    const seen = new Set<ResourceId>([item.id])
    let depth = 0

    while (parentId) {
      if (depth >= MAX_SIDEBAR_TREE_DEPTH) {
        throw new Error(`Max resource operation depth exceeded at ${parentId}`)
      }
      if (seen.has(parentId)) {
        throw new Error(
          `Cycle detected while normalizing selected resources at parent ${parentId} for item ${item.id}`,
        )
      }
      seen.add(parentId)
      const parent = allItemsMap.get(parentId)
      if (!parent) {
        throw new Error(
          `Missing resource ancestor ${parentId} while normalizing selected item ${item.id}`,
        )
      }
      if (selectedIds.has(parentId)) return false
      parentId = parent.parentId
      depth += 1
    }

    normalizedIds.add(item.id)
    return true
  })
}
