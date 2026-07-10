import { selectionBelongsToSurface } from '../../filesystem/selection'
import type { ResourceOperationItems } from '../../filesystem/catalog'
import type { ResourceShareSource, ResourceShareState } from '../../sharing/contracts'
import type { AnyItem } from '../items'
import type { SidebarWorkspaceState } from './workspace-state'
import type { ReactNode } from 'react'

export interface SidebarShareButtonSource {
  renderItemsShareState: (
    items: Array<AnyItem>,
    render: (state: ResourceShareState) => ReactNode,
  ) => ReactNode
  getShareItems: (item: AnyItem) => Array<AnyItem>
}

export function createSidebarShareButtonSource({
  operationItems,
  sharing,
  sidebarSelection,
}: {
  operationItems: Pick<ResourceOperationItems, 'resolveItems'>
  sharing: ResourceShareSource
  sidebarSelection: Pick<SidebarWorkspaceState['selectionCommands'], 'getSelectionSnapshot'>
}): SidebarShareButtonSource | undefined {
  if (sharing.status !== 'available') return undefined

  return {
    renderItemsShareState: sharing.renderItemsShareState,
    getShareItems: (item) =>
      operationItems.resolveItems({
        itemIds: getShareTargetItemIds(item, sidebarSelection.getSelectionSnapshot()),
      }),
  }
}

function getShareTargetItemIds(
  item: AnyItem,
  snapshot: ReturnType<SidebarWorkspaceState['selectionCommands']['getSelectionSnapshot']>,
) {
  return snapshot.activeItemSurface &&
    snapshot.selectedItemIds.includes(item.id) &&
    selectionBelongsToSurface(snapshot.selectedItemIds, snapshot.activeItemSurface.visibleItemIds)
    ? snapshot.selectedItemIds
    : [item.id]
}
