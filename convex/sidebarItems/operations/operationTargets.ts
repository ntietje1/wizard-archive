import type { Id } from '../../_generated/dataModel'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import type { SidebarItemLocation } from '../types/baseTypes'

export interface SidebarOperationSurface {
  parentId: Id<'sidebarItems'> | null
}

export function getPasteTargetParentId(
  activeItemSurface: SidebarOperationSurface | null,
  fallbackParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  return fallbackParentId ?? activeItemSurface?.parentId ?? null
}

export function normalizeRestoreTargetParentId(
  targetParentId: Id<'sidebarItems'> | null,
  targetParentLocation: SidebarItemLocation | null | undefined,
): Id<'sidebarItems'> | null {
  if (!targetParentId) return null
  return targetParentLocation === SIDEBAR_ITEM_LOCATION.trash ? null : targetParentId
}

export function getRestoreTargetParentId<T extends { location: SidebarItemLocation }>(
  activeItemSurface: SidebarOperationSurface | null,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, T>,
  fallbackParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  const targetParentId = getPasteTargetParentId(activeItemSurface, fallbackParentId)
  const targetParent = targetParentId ? itemsMap.get(targetParentId) : null
  if (targetParentId && !targetParent) return null
  return normalizeRestoreTargetParentId(targetParentId, targetParent?.location)
}
