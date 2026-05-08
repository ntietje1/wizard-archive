import { SIDEBAR_ITEM_LOCATION } from 'convex/sidebarItems/types/baseTypes'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { ActiveItemSurface } from '~/features/sidebar/stores/sidebar-ui-store'

export function getPasteTargetParentId(
  activeItemSurface: ActiveItemSurface | null,
  fallbackParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  return fallbackParentId ?? activeItemSurface?.parentId ?? null
}

export function getRestoreTargetParentId(
  activeItemSurface: ActiveItemSurface | null,
  itemsMap: ReadonlyMap<Id<'sidebarItems'>, AnySidebarItem>,
  fallbackParentId?: Id<'sidebarItems'> | null,
): Id<'sidebarItems'> | null {
  const targetParentId = getPasteTargetParentId(activeItemSurface, fallbackParentId)
  if (!targetParentId) return null

  const targetParent = itemsMap.get(targetParentId)
  return targetParent?.location === SIDEBAR_ITEM_LOCATION.trash ? null : targetParentId
}
