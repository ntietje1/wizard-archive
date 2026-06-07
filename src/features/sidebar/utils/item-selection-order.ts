import type { SortOptions } from 'shared/editor/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { sortItemsByOptions } from '~/features/sidebar/utils/sidebar-item-sort'

interface BuildVisibleSidebarItemIdsOptions {
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  expandedFolderIds: ReadonlySet<Id<'sidebarItems'>>
  sortOptions: SortOptions
}

interface BuildVisibleSidebarItemIdsInternalOptions extends BuildVisibleSidebarItemIdsOptions {
  parentId: Id<'sidebarItems'> | null
  accumulator: Array<Id<'sidebarItems'>>
  visited: Set<Id<'sidebarItems'>>
}

function appendVisibleSidebarItemIds({
  parentItemsMap,
  expandedFolderIds,
  sortOptions,
  parentId,
  accumulator,
  visited,
}: BuildVisibleSidebarItemIdsInternalOptions): Array<Id<'sidebarItems'>> {
  const items = sortItemsByOptions(sortOptions, parentItemsMap.get(parentId)) ?? []

  for (const item of items) {
    if (visited.has(item._id)) continue
    visited.add(item._id)
    accumulator.push(item._id)
    if (item.type === SIDEBAR_ITEM_TYPES.folders && expandedFolderIds.has(item._id)) {
      appendVisibleSidebarItemIds({
        parentItemsMap,
        expandedFolderIds,
        sortOptions,
        parentId: item._id,
        accumulator,
        visited,
      })
    }
  }

  return accumulator
}

export function buildVisibleSidebarItemIds(
  options: BuildVisibleSidebarItemIdsOptions,
): Array<Id<'sidebarItems'>> {
  return appendVisibleSidebarItemIds({
    ...options,
    parentId: null,
    accumulator: [],
    visited: new Set(),
  })
}
