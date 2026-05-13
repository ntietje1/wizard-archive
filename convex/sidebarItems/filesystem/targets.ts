import type { Id } from '../../_generated/dataModel'
import { isTrashedSidebarItem } from '../types/status'
import type { SidebarItemLocation, SidebarItemStatus } from '../types/baseTypes'

export function normalizeRestoreTargetParentId(
  targetParentId: Id<'sidebarItems'> | null,
  targetParent: { location: SidebarItemLocation; status: SidebarItemStatus } | null | undefined,
): Id<'sidebarItems'> | null {
  if (!targetParentId) return null
  if (!targetParent || isTrashedSidebarItem(targetParent)) return null
  return targetParentId
}
