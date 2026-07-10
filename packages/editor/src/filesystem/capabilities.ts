import {
  evaluatePermanentDelete,
  evaluateRestore,
  evaluateTrash,
} from './domain/operation-capabilities'
import type { OperationActorSnapshot, OperationResourceItem } from './domain/operation-capabilities'
import {
  PERMISSION_OPERATION,
  hasPermissionForOperation,
} from '../../../../shared/permissions/requirements'
import { isActiveResourceItem } from '../workspace/items'

export function canRenameSidebarItem(item: OperationResourceItem) {
  return (
    isActiveResourceItem(item) &&
    hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM)
  )
}

function canTrashSidebarItems(actor: OperationActorSnapshot, items: Array<OperationResourceItem>) {
  return items.length > 0 && items.every((item) => evaluateTrash(actor, item).ok)
}

function canRestoreSidebarItems(
  actor: OperationActorSnapshot,
  items: Array<OperationResourceItem>,
) {
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        evaluateRestore(actor, item, {
          parentId: null,
          parent: null,
        }).ok,
    )
  )
}

function canDeleteSidebarItemsForever(
  actor: OperationActorSnapshot,
  items: Array<OperationResourceItem>,
) {
  return items.length > 0 && items.every((item) => evaluatePermanentDelete(actor, item).ok)
}

export function getSidebarFilesystemCapabilities(
  actor: OperationActorSnapshot,
  items: Array<OperationResourceItem>,
) {
  return {
    canTrash: canTrashSidebarItems(actor, items),
    canRestore: canRestoreSidebarItems(actor, items),
    canDeleteForever: canDeleteSidebarItemsForever(actor, items),
  }
}
