import { RESOURCE_TYPES } from '../../items-persistence-contract'
import type { AnyItem } from '../../items'
import type { SortOptions } from '../../items-persistence-contract'
import type { SidebarItemId } from 'shared/common/ids'
import { sortItemsByOptions } from './sidebar-item-sort'

interface BuildVisibleSidebarItemIdsOptions {
  getChildren: (parentId: SidebarItemId) => ReadonlyArray<AnyItem>
  getRoots: () => ReadonlyArray<AnyItem>
  expandedFolderIds: ReadonlySet<SidebarItemId>
  sortOptions: SortOptions
}

interface BuildVisibleSidebarItemIdsInternalOptions {
  getChildren: BuildVisibleSidebarItemIdsOptions['getChildren']
  expandedFolderIds: ReadonlySet<SidebarItemId>
  items: ReadonlyArray<AnyItem>
  sortOptions: SortOptions
  accumulator: Array<SidebarItemId>
  visited: Set<SidebarItemId>
}

function appendVisibleSidebarItemIds({
  getChildren,
  expandedFolderIds,
  items,
  sortOptions,
  accumulator,
  visited,
}: BuildVisibleSidebarItemIdsInternalOptions): Array<SidebarItemId> {
  const sortedItems = sortItemsByOptions(sortOptions, items)

  for (const item of sortedItems) {
    if (visited.has(item.id)) continue
    visited.add(item.id)
    accumulator.push(item.id)
    if (item.type === RESOURCE_TYPES.folders && expandedFolderIds.has(item.id)) {
      appendVisibleSidebarItemIds({
        getChildren,
        expandedFolderIds,
        items: getChildren(item.id),
        sortOptions,
        accumulator,
        visited,
      })
    }
  }

  return accumulator
}

export function buildVisibleSidebarItemIds(
  options: BuildVisibleSidebarItemIdsOptions,
): Array<SidebarItemId> {
  return appendVisibleSidebarItemIds({
    ...options,
    items: options.getRoots(),
    accumulator: [],
    visited: new Set(),
  })
}
