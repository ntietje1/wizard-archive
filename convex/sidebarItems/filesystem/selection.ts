import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem, AnySidebarItemRow } from '../types/types'

const MAX_OPERATION_DEPTH = 50

type SelectionRootItem = Pick<AnySidebarItemRow, '_id' | 'parentId' | 'type'>

export function selectionBelongsToSurface(
  selectedIds: Array<Id<'sidebarItems'>>,
  visibleItemIds: Array<Id<'sidebarItems'>>,
): boolean {
  if (selectedIds.length === 0) return false
  const visible = new Set(visibleItemIds)
  return selectedIds.every((id) => visible.has(id))
}

export function normalizeTopLevelSelectedItemsBestEffort<
  T extends Pick<AnySidebarItem, '_id' | 'parentId'>,
>(
  items: Array<T | null | undefined>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>,
): Array<T> {
  return normalizeRootItemsBestEffort(
    items.filter((item): item is T => Boolean(item)),
    allItemsMap,
  )
}

export function normalizeTopLevelSelectedItemsWithDescendants<
  T extends Pick<AnySidebarItem, '_id' | 'parentId'>,
>(
  items: Array<T>,
  childrenMap: ReadonlyMap<Id<'sidebarItems'>, Array<Pick<AnySidebarItem, '_id' | 'parentId'>>>,
): Array<T> {
  const allItems = new Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>()

  for (const item of items) {
    allItems.set(item._id, item)
  }
  for (const children of childrenMap.values()) {
    for (const child of children) {
      allItems.set(child._id, child)
    }
  }

  return normalizeTopLevelSelectedItemsBestEffort(items, allItems)
}

export type OperationPlannerItem = Pick<
  AnySidebarItemRow,
  '_id' | 'parentId' | 'name' | 'type' | 'location' | 'status'
>

export function normalizePlannerRootItemsStrict(
  items: Array<OperationPlannerItem>,
  getChildren?: (parentId: Id<'sidebarItems'>) => Array<OperationPlannerItem>,
  depth = 0,
): Array<OperationPlannerItem> {
  return normalizeRootItemsStrict(items, { getChildren, depth })
}

function normalizeRootItemsBestEffort<T extends Pick<AnySidebarItem, '_id' | 'parentId'>>(
  items: Array<T>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>,
): Array<T> {
  const selectedIds = new Set(items.map((item) => item._id))
  const normalizedIds = new Set<Id<'sidebarItems'>>()

  return items.filter((item) => {
    // De-duplicate repeated ids while preserving the first occurrence in selection order.
    if (normalizedIds.has(item._id)) return false

    let parentId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>()

    while (parentId) {
      if (seen.has(parentId)) break
      seen.add(parentId)
      const parent = allItemsMap.get(parentId)
      // Stale frontend maps can be missing ancestors; keep normalization best-effort.
      if (!parent) break
      // Keep self-referential stale rows as roots instead of dropping them from best-effort selection.
      if (parentId === item._id) break
      if (selectedIds.has(parentId)) return false
      parentId = parent.parentId
    }

    normalizedIds.add(item._id)
    return true
  })
}

function normalizeRootItemsStrict<T extends SelectionRootItem>(
  items: Array<T>,
  {
    getChildren,
    depth = 0,
  }: {
    getChildren?: (parentId: Id<'sidebarItems'>) => Array<T>
    depth?: number
  },
): Array<T> {
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
