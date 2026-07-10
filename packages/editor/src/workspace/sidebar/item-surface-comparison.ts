import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { SidebarWorkspaceItemSurface } from './workspace-state'

function sameVisibleItemIds(
  a: ReadonlyArray<SidebarItemId>,
  b: ReadonlyArray<SidebarItemId>,
): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

export function sameItemSurfaceWithVisibleIds(
  a: SidebarWorkspaceItemSurface | null,
  b: SidebarWorkspaceItemSurface | null,
): boolean {
  if (!sameItemSurfaceIdentity(a, b)) return false
  if (!a || !b) return true
  return sameVisibleItemIds(a.visibleItemIds, b.visibleItemIds)
}

export function sameItemSurfaceIdentity(
  a: SidebarWorkspaceItemSurface | null,
  b: SidebarWorkspaceItemSurface | null,
): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.surface === b.surface && a.parentId === b.parentId
}
