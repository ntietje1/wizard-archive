import type { SortOptions } from 'convex/editors/types'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { sortItemsByOptions } from '~/features/sidebar/hooks/useSidebarItems'

export interface BuildVisibleSidebarItemIdsOptions {
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  expandedFolderIds: ReadonlySet<Id<'sidebarItems'>>
  sortOptions: SortOptions
  parentId?: Id<'sidebarItems'> | null
  accumulator?: Array<Id<'sidebarItems'>>
}

export function buildVisibleSidebarItemIds({
  parentItemsMap,
  expandedFolderIds,
  sortOptions,
  parentId = null,
  accumulator = [],
}: BuildVisibleSidebarItemIdsOptions): Array<Id<'sidebarItems'>> {
  const items = sortItemsByOptions(sortOptions, parentItemsMap.get(parentId)) ?? []

  for (const item of items) {
    accumulator.push(item._id)
    if (item.type !== SIDEBAR_ITEM_TYPES.folders || !expandedFolderIds.has(item._id)) {
      continue
    }

    buildVisibleSidebarItemIds({
      parentItemsMap,
      expandedFolderIds,
      sortOptions,
      parentId: item._id,
      accumulator,
    })
  }

  return accumulator
}
