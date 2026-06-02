import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES, isTrashedSidebarItem } from 'shared/sidebar-items/types'
import type { SidebarItemStatus } from 'shared/sidebar-items/types'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

export interface SidebarOperationSurface {
  parentId: Id<'sidebarItems'> | null
}

export function getPasteTargetParentId(
  activeItemSurface: SidebarOperationSurface | null,
  targetParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  return targetParentId === undefined ? (activeItemSurface?.parentId ?? null) : targetParentId
}

export function getRestoreTargetParentId<T extends { status: SidebarItemStatus }>(
  activeItemSurface: SidebarOperationSurface | null,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, T>,
  targetParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  const resolvedParentId = getPasteTargetParentId(activeItemSurface, targetParentId)
  const targetParent = resolvedParentId ? itemsMap.get(resolvedParentId) : null
  if (!resolvedParentId || !targetParent || isTrashedSidebarItem(targetParent)) return null
  return resolvedParentId
}

export function getKeyboardPasteParentId({
  selectedItems,
  surface,
  surfaceParentId,
}: {
  selectedItems: Array<AnySidebarItem>
  surface: ItemSurface
  surfaceParentId: Id<'sidebarItems'> | null
}): Id<'sidebarItems'> | null {
  if (surface !== 'sidebar' && surface !== 'bookmarks') return surfaceParentId
  if (selectedItems.length === 0) return surfaceParentId

  const [firstItem] = selectedItems
  if (selectedItems.every((item) => item.parentId === firstItem.parentId)) {
    return firstItem.parentId
  }

  return surfaceParentId
}

export function getContextMenuPasteParentId({
  clickedItem,
  operationItems,
}: {
  clickedItem?: AnySidebarItem
  operationItems: Array<AnySidebarItem>
}): Id<'sidebarItems'> | null | undefined {
  if (clickedItem?.type === SIDEBAR_ITEM_TYPES.folders) return clickedItem._id
  if (operationItems.length === 0) return undefined

  const [firstItem] = operationItems
  if (operationItems.every((item) => item.parentId === firstItem.parentId)) {
    return firstItem.parentId
  }

  return undefined
}
