import { isActiveSidebarItem, isTrashedSidebarItem } from '../types/status'
import type { SidebarItemLifecycleFields } from '../types/status'

export function isSidebarItemActive(item: SidebarItemLifecycleFields): boolean {
  return isActiveSidebarItem(item)
}

export function isSidebarItemTrashed(item: SidebarItemLifecycleFields): boolean {
  return isTrashedSidebarItem(item)
}
