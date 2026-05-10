import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItemRow } from '../types/types'

const MAX_OPERATION_DEPTH = 50

export type OperationPlannerItem = Pick<
  AnySidebarItemRow,
  '_id' | 'parentId' | 'name' | 'type' | 'location'
>

export function removeSelectedDescendants(
  items: Array<OperationPlannerItem>,
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>,
  depth = 0,
): Array<OperationPlannerItem> {
  if (depth >= MAX_OPERATION_DEPTH) {
    throw new Error(`Max sidebar operation depth exceeded while normalizing selection`)
  }

  const selectedIds = new Set(items.map((item) => item._id))
  const itemsById = new Map(items.map((item) => [item._id, item]))
  const descendantIds = new Set<Id<'sidebarItems'>>()
  const normalizedIds = new Set<Id<'sidebarItems'>>()

  if (getChildren) {
    const collect = (parentId: Id<'sidebarItems'>, currentDepth: number) => {
      if (currentDepth >= MAX_OPERATION_DEPTH) {
        throw new Error(`Max sidebar operation depth exceeded at ${parentId}`)
      }
      for (const child of getChildren(parentId)) {
        descendantIds.add(child._id)
        if (child.type === SIDEBAR_ITEM_TYPES.folders) {
          collect(child._id, currentDepth + 1)
        }
      }
    }

    for (const item of items) {
      if (item.type === SIDEBAR_ITEM_TYPES.folders) {
        collect(item._id, depth)
      }
    }
  }

  return items.filter((item) => {
    if (descendantIds.has(item._id)) return false
    if (normalizedIds.has(item._id)) return false

    let parentId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>([item._id])
    let currentDepth = depth
    while (parentId) {
      if (currentDepth >= MAX_OPERATION_DEPTH) {
        throw new Error(`Max sidebar operation depth exceeded at ${parentId}`)
      }
      if (selectedIds.has(parentId)) return false
      if (seen.has(parentId)) {
        throw new Error(
          `Cycle detected while normalizing selected sidebar items at parent ${parentId} for item ${item._id}`,
        )
      }
      seen.add(parentId)
      parentId = itemsById.get(parentId)?.parentId ?? null
      currentDepth += 1
    }
    normalizedIds.add(item._id)
    return true
  })
}
