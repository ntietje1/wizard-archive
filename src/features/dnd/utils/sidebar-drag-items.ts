import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { normalizeFileSystemOperationItems } from '~/features/filesystem/normalizeFileSystemOperationItems'
import { getDragItemIds } from '~/features/dnd/utils/drag-source-data'

export function resolveNormalizedDraggedSidebarItems({
  sourceData,
  activeItemsMap,
  trashedItemsMap = new Map(),
  excludeItemIds = [],
  includeTrashed = false,
}: {
  sourceData: Record<string, unknown>
  activeItemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  trashedItemsMap?: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>
  excludeItemIds?: ReadonlyArray<Id<'sidebarItems'>>
  includeTrashed?: boolean
}): Array<AnySidebarItem> {
  const allItemsMap = new Map<Id<'sidebarItems'>, AnySidebarItem>([
    ...activeItemsMap,
    ...trashedItemsMap,
  ])
  const excluded = new Set(excludeItemIds)
  const draggedItems = getDragItemIds(sourceData)
    .map((id) => allItemsMap.get(id))
    .filter((item): item is AnySidebarItem => {
      if (!item) return false
      return !excluded.has(item._id) && (includeTrashed || !item.isTrashed)
    })

  return normalizeFileSystemOperationItems(draggedItems, allItemsMap)
}
