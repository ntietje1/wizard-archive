import type { Id } from '../../_generated/dataModel'
import { isTrashedSidebarItem } from '../types/status'
import type { SidebarItemStatus } from '../types/baseTypes'

export function normalizeRestoreTargetParentId(
  targetParentId: Id<'sidebarItems'> | null,
  targetParent: { status: SidebarItemStatus } | null | undefined,
): Id<'sidebarItems'> | null {
  if (!targetParentId) return null
  if (typeof targetParent !== 'object') return null
  if (!targetParent || isTrashedSidebarItem(targetParent)) return null
  return targetParentId
}
