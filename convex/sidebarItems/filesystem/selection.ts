import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItemRow } from '../types/types'

const MAX_OPERATION_DEPTH = 50
type SidebarItemTreeNode = {
  _id: Id<'sidebarItems'>
  parentId: Id<'sidebarItems'> | null
}

export function selectionBelongsToSurface(
  selectedIds: Array<Id<'sidebarItems'>>,
  visibleItemIds: Array<Id<'sidebarItems'>>,
): boolean {
  if (selectedIds.length === 0) return false
  const visible = new Set(visibleItemIds)
  return selectedIds.every((id) => visible.has(id))
}

export function normalizeSelectedRoots<T extends SidebarItemTreeNode>(
  items: Array<T>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, SidebarItemTreeNode>,
): Array<T> {
  return normalizeRootItems(items, allItemsMap)
}

export type OperationPlannerItem = Pick<
  AnySidebarItemRow,
  '_id' | 'parentId' | 'name' | 'type' | 'status'
>

function normalizeRootItems<T extends SidebarItemTreeNode>(
  items: Array<T>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, SidebarItemTreeNode>,
): Array<T> {
  const selectedIds = new Set(items.map((item) => item._id))
  const normalizedIds = new Set<Id<'sidebarItems'>>()

  return items.filter((item) => {
    // De-duplicate repeated ids while preserving the first occurrence in selection order.
    if (normalizedIds.has(item._id)) return false

    let parentId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>([item._id])
    let depth = 0

    while (parentId) {
      if (depth >= MAX_OPERATION_DEPTH) {
        throw new Error(`Max sidebar operation depth exceeded at ${parentId}`)
      }
      if (seen.has(parentId)) {
        throw new Error(
          `Cycle detected while normalizing selected sidebar items at parent ${parentId} for item ${item._id}`,
        )
      }
      seen.add(parentId)
      const parent = allItemsMap.get(parentId)
      if (!parent) {
        throw new Error(
          `Missing sidebar item ancestor ${parentId} while normalizing selected item ${item._id}`,
        )
      }
      if (selectedIds.has(parentId)) return false
      parentId = parent.parentId
      depth += 1
    }

    normalizedIds.add(item._id)
    return true
  })
}
