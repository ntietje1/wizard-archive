import type { ResourceId } from '../resources/domain-id'
import { useMemo } from 'react'
import type { AnyItem } from '../workspace/items'

import { selectionBelongsToSurface } from '../filesystem/selection'
import type { ResourceOperationItems } from '../filesystem/catalog'
import { useSidebarWorkspaceState } from '../workspace/sidebar/workspace-state'
import type { SidebarWorkspaceState } from '../workspace/sidebar/workspace-state'

type SidebarDragSelection = Pick<
  SidebarWorkspaceState['selection'],
  'activeItemSurface' | 'selectedItemIds'
>

interface SidebarDragCatalog {
  getKnownItemById: (id: ResourceId) => AnyItem | null | undefined
}

interface SidebarDragDataSourceInput {
  catalog: SidebarDragCatalog
  operationItems: ResourceOperationItems
}

export interface SidebarDragDataSource {
  getSidebarDragData: (
    item: AnyItem,
    selection: SidebarDragSelection,
  ) => {
    sidebarItemId: ResourceId
    sidebarItemIds: Array<ResourceId>
    dragPreviewItemIds: Array<ResourceId>
  }
}

export function createSidebarDragDataSource({
  catalog,
  operationItems,
}: SidebarDragDataSourceInput): SidebarDragDataSource {
  return {
    getSidebarDragData: (item, selection) =>
      createSidebarDragData(item, selection, catalog, operationItems),
  }
}

export function useSidebarDragData(item: AnyItem, source: SidebarDragDataSource) {
  const {
    selection: { activeItemSurface, selectedItemIds },
  } = useSidebarWorkspaceState()
  return useMemo(
    () => source.getSidebarDragData(item, { activeItemSurface, selectedItemIds }),
    [activeItemSurface, item, selectedItemIds, source],
  )
}

function createSidebarDragData(
  item: AnyItem,
  { activeItemSurface, selectedItemIds }: SidebarDragSelection,
  catalog: SidebarDragCatalog,
  operationItems: ResourceOperationItems,
) {
  if (!activeItemSurface?.visibleItemIds.includes(item.id)) {
    return {
      sidebarItemId: item.id,
      sidebarItemIds: [item.id],
      dragPreviewItemIds: [item.id],
    }
  }

  const selectedItems = selectedItemIds.flatMap((id) => {
    const selectedItem = catalog.getKnownItemById(id)
    return selectedItem ? [selectedItem] : []
  })
  const selectedKnownItemIds = selectedItems.map((selectedItem) => selectedItem.id)
  const belongsToSelection =
    selectedKnownItemIds.includes(item.id) &&
    selectionBelongsToSurface(selectedKnownItemIds, activeItemSurface.visibleItemIds)
  const itemIds = belongsToSelection
    ? operationItems
        .resolveItems({ itemIds: selectedKnownItemIds })
        .map((selectedItem) => selectedItem.id)
    : [item.id]
  const previewItemIds = belongsToSelection
    ? selectedItems.map((selectedItem) => selectedItem.id)
    : [item.id]

  return {
    sidebarItemId: item.id,
    sidebarItemIds: itemIds,
    dragPreviewItemIds: previewItemIds,
  }
}
