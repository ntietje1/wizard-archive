import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import { normalizeSelectedRoots } from 'convex/sidebarItems/filesystem/selection'
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
    .filter((id) => !excluded.has(id))
    .map((id) => {
      const item = allItemsMap.get(id)
      if (!item) {
        throw new Error(`Drag source references missing sidebar item ${id}`)
      }
      return item
    })
    .filter((item) => includeTrashed || !item.isTrashed)

  return normalizeSelectedRoots(draggedItems, allItemsMap)
}
