import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

export function selectionBelongsToSurface(
  selectedIds: Array<Id<'sidebarItems'>>,
  visibleItemIds: Array<Id<'sidebarItems'>>,
): boolean {
  if (selectedIds.length === 0) return false
  const visible = new Set(visibleItemIds)
  return selectedIds.every((id) => visible.has(id))
}

export function normalizeTopLevelSelectedItems<T extends Pick<AnySidebarItem, '_id' | 'parentId'>>(
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
      if (!parent) {
        console.warn(`Missing parent ${parentId} while normalizing selection for item ${item._id}`)
        break
      }
      if (parentId === item._id) {
        throw new Error(`Cycle detected while normalizing selected sidebar item ${item._id}`)
      }
      if (selectedIds.has(parentId)) return false
      parentId = parent.parentId
    }

    normalizedIds.add(item._id)
    return true
  })
}
