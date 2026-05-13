import type { Id } from 'convex/_generated/dataModel'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { SidebarItemLocation, SidebarItemStatus } from 'convex/sidebarItems/types/baseTypes'
import { isTrashedSidebarItem } from 'convex/sidebarItems/types/status'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

export interface SidebarOperationSurface {
  parentId: Id<'sidebarItems'> | null
}

export function getPasteTargetParentId(
  activeItemSurface: SidebarOperationSurface | null,
  targetParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  return targetParentId !== undefined ? targetParentId : (activeItemSurface?.parentId ?? null)
}

export function getRestoreTargetParentId<
  T extends { location: SidebarItemLocation; status: SidebarItemStatus },
>(
  activeItemSurface: SidebarOperationSurface | null,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, T>,
  targetParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  const resolvedParentId = getPasteTargetParentId(activeItemSurface, targetParentId)
  const targetParent = resolvedParentId ? itemsMap.get(resolvedParentId) : null
  if (!resolvedParentId || !targetParent || isTrashedSidebarItem(targetParent)) return null
  return resolvedParentId
}

function getCommonParentId(
  items: Array<Pick<AnySidebarItem, 'parentId'>>,
): Id<'sidebarItems'> | null | undefined {
  if (items.length === 0) return undefined
  const parentId = items[0].parentId
  return items.every((item) => item.parentId === parentId) ? parentId : undefined
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
  const selectedParentId = getCommonParentId(selectedItems)
  return selectedParentId === undefined ? surfaceParentId : selectedParentId
}

export function getContextMenuPasteParentId({
  clickedItem,
  operationItems,
}: {
  clickedItem?: AnySidebarItem
  operationItems: Array<AnySidebarItem>
}): Id<'sidebarItems'> | null | undefined {
  if (clickedItem?.type === SIDEBAR_ITEM_TYPES.folders) return clickedItem._id
  return getCommonParentId(operationItems)
}
