import { SIDEBAR_ITEM_STATUS } from '../../../shared/sidebar-items/types'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemStatus } from '../../../shared/sidebar-items/types'

export type SidebarItemLifecycleFields = {
  status: SidebarItemStatus
  deletionTime?: number | null
  deletedBy?: Id<'userProfiles'> | null
}

export function assertSidebarItemLifecycleConsistency(item: SidebarItemLifecycleFields): void {
  if (
    item.status === SIDEBAR_ITEM_STATUS.trashed &&
    (item.deletionTime == null || item.deletedBy == null)
  ) {
    throw new Error('Trashed sidebar items require deletion metadata')
  }
  if (
    item.status === SIDEBAR_ITEM_STATUS.active &&
    (item.deletionTime != null || item.deletedBy != null)
  ) {
    throw new Error('Active sidebar items cannot have trash lifecycle metadata')
  }
  if (
    item.status === SIDEBAR_ITEM_STATUS.undoHidden &&
    (item.deletionTime != null || item.deletedBy != null)
  ) {
    throw new Error('Undo-hidden sidebar items cannot have trash lifecycle metadata')
  }
}

export function isActiveSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === SIDEBAR_ITEM_STATUS.active
}

export function isTrashedSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === SIDEBAR_ITEM_STATUS.trashed
}

export function isUndoHiddenSidebarItem(item: SidebarItemLifecycleFields): boolean {
  return item.status === SIDEBAR_ITEM_STATUS.undoHidden
}

export function normalizeSidebarItemLifecycle<T extends SidebarItemLifecycleFields>(
  item: T,
): T & { status: SidebarItemStatus } {
  assertSidebarItemLifecycleConsistency(item)
  return {
    ...item,
    status: item.status,
  }
}
