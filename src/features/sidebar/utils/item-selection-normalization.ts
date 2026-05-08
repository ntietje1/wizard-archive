import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export function selectionBelongsToSurface(
  selectedIds: Array<Id<'sidebarItems'>>,
  visibleItemIds: Array<Id<'sidebarItems'>>,
): boolean {
  if (selectedIds.length === 0) return false
  const visible = new Set(visibleItemIds)
  return selectedIds.every((id) => visible.has(id))
}

/**
 * Keeps only selected roots by filtering out items whose ancestor is also in
 * selectedIds. The seen set guards against corrupted parent cycles; in that
 * defensive case the item is kept so normalization does not drop data by guess.
 */
export function normalizeTopLevelSelectedItems<T extends Pick<AnySidebarItem, '_id' | 'parentId'>>(
  items: Array<T>,
  allItemsMap: ReadonlyMap<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>,
): Array<T> {
  const selectedIds = new Set(items.map((item) => item._id))

  return items.filter((item) => {
    let parentId = item.parentId
    const seen = new Set<Id<'sidebarItems'>>()

    while (parentId) {
      if (selectedIds.has(parentId)) return false
      if (seen.has(parentId)) {
        console.warn('Cycle detected while normalizing sidebar selection', {
          itemId: item._id,
          parentId,
        })
        return true
      }
      seen.add(parentId)
      const parent = allItemsMap.get(parentId)
      if (!parent) {
        console.warn('Missing parent while normalizing sidebar selection', {
          itemId: item._id,
          parentId,
        })
        break
      }
      parentId = parent.parentId
    }

    return true
  })
}
