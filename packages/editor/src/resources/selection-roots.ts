import type { ResourceId } from './domain-id'

const MAX_RESOURCE_TREE_DEPTH = 50

type ResourceTreeNode<TId extends string> = {
  id: TId
  parentId: TId | null
}

export function normalizeSelectedRoots<
  TId extends string = ResourceId,
  T extends ResourceTreeNode<TId> = ResourceTreeNode<TId>,
>(items: Array<T>, allItemsMap: ReadonlyMap<TId, ResourceTreeNode<TId>>): Array<T> {
  const selectedIds = new Set(items.map((item) => item.id))
  const normalizedIds = new Set<TId>()

  return items.filter((item) => {
    if (normalizedIds.has(item.id)) return false

    let parentId = item.parentId
    const seen = new Set<TId>([item.id])
    let depth = 0
    let hasSelectedAncestor = false

    while (parentId) {
      if (depth >= MAX_RESOURCE_TREE_DEPTH) {
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
      if (selectedIds.has(parentId)) hasSelectedAncestor = true
      parentId = parent.parentId
      depth += 1
    }

    if (hasSelectedAncestor) return false
    normalizedIds.add(item.id)
    return true
  })
}
