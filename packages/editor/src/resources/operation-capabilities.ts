import type { ResourceId } from './domain-id'
import {
  PERMISSION_OPERATION,
  hasPermissionForOperation,
} from '../../../../shared/permissions/requirements'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import { isActiveResourceItem } from './items'
import { RESOURCE_TYPES } from './items-persistence-contract'
import { isTrashedSidebarItem } from './items/status'
import type { ResourcePatchRow } from './patch-contract'

export type ResourceOperationRejectionCode =
  | 'not_found'
  | 'not_folder'
  | 'trashed_folder'
  | 'trashed_item'
  | 'already_trashed'
  | 'not_trashed'
  | 'no_source_permission'
  | 'no_target_permission'
  | 'dm_only'
  | 'circular'
  | 'missing_ancestor_ids'
  | 'invalid_target'

export type ResourceOperationCapability =
  | { ok: true }
  | { ok: false; code: ResourceOperationRejectionCode; message: string }

export type OperationActorSnapshot = {
  canCreateRootItems: boolean
  canManageFolders: boolean
}

export type OperationResourceItem<TId extends string = ResourceId> = Pick<
  ResourcePatchRow,
  'type' | 'status'
> & {
  id: TId
  parentId: TId | null
  myPermissionLevel?: PermissionLevel | null
}

type OperationTargetSnapshot<TId extends string> = {
  parentId: TId | null
  parent: OperationResourceItem<TId> | null
  ancestorIds?: Array<TId>
}

function ok(): ResourceOperationCapability {
  return { ok: true }
}

function reject(
  code: ResourceOperationRejectionCode,
  message: string,
): ResourceOperationCapability {
  return { ok: false, code, message }
}

export function isResourceOperationPermissionRejection(
  code: ResourceOperationRejectionCode,
): boolean {
  return code === 'no_source_permission' || code === 'no_target_permission' || code === 'dm_only'
}

function evaluateParentAccess<TId extends string>(
  target: OperationTargetSnapshot<TId>,
): ResourceOperationCapability {
  if (target.parentId === null) return ok()

  if (!target.parent) {
    return reject('not_found', 'Parent not found')
  }

  if (target.parent.type !== RESOURCE_TYPES.folders) {
    return reject('not_folder', 'Parent must be a folder')
  }

  if (isTrashedSidebarItem(target.parent)) {
    return reject('trashed_folder', 'Trashed folders are uneditable')
  }

  if (!isActiveResourceItem(target.parent)) {
    return reject('invalid_target', 'Parent is no longer available')
  }

  if (
    !hasPermissionForOperation(
      target.parent.myPermissionLevel,
      PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM,
    )
  ) {
    return reject('no_target_permission', 'You do not have sufficient permission for this folder')
  }

  return ok()
}

function evaluateRootCreationAccess(actor: OperationActorSnapshot): ResourceOperationCapability {
  return actor.canCreateRootItems
    ? ok()
    : reject('dm_only', 'Only the DM can create items at the root level')
}

export function evaluateCreateItem(
  actor: Pick<OperationActorSnapshot, 'canManageFolders'>,
  itemType: OperationResourceItem['type'],
): ResourceOperationCapability {
  if (itemType === RESOURCE_TYPES.folders && !actor.canManageFolders) {
    return reject('dm_only', 'Only the DM can create folders')
  }

  return ok()
}

function evaluateTargetParent<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
  target: OperationTargetSnapshot<TId>,
): ResourceOperationCapability {
  const parentAccess = evaluateParentAccess(target)
  if (!parentAccess.ok) return parentAccess
  if (target.parentId === null) return evaluateRootCreationAccess(actor)

  if (item.type === RESOURCE_TYPES.folders) {
    if (!target.ancestorIds) {
      return reject('missing_ancestor_ids', 'Folder target ancestry is required')
    }
    if (target.parentId === item.id || target.ancestorIds.includes(item.id)) {
      return reject('circular', 'This move would create a circular reference')
    }
  }

  return ok()
}

export function evaluateMoveToParent<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
  target: OperationTargetSnapshot<TId>,
): ResourceOperationCapability {
  if (!isActiveResourceItem(item)) {
    return reject('trashed_item', 'Only active items can be moved')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return evaluateTargetParent(actor, item, target)
}

export function evaluateTrash<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
): ResourceOperationCapability {
  if (!isActiveResourceItem(item) && !isTrashedSidebarItem(item)) {
    return reject('invalid_target', 'Only active items can be moved to trash')
  }

  if (isTrashedSidebarItem(item)) {
    return reject('already_trashed', 'This item is already in the trash')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.TRASH_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (item.type === RESOURCE_TYPES.folders && !actor.canManageFolders) {
    return reject('dm_only', 'Only the DM can trash folders')
  }

  return ok()
}

export function evaluateRestore<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
  target: OperationTargetSnapshot<TId>,
): ResourceOperationCapability {
  if (!isTrashedSidebarItem(item)) {
    return reject('not_trashed', 'Only trashed items can be restored')
  }

  if (
    !hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.RESTORE_SIDEBAR_ITEM)
  ) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (item.type === RESOURCE_TYPES.folders && !actor.canManageFolders) {
    return reject('dm_only', 'Only the DM can restore folders')
  }

  return evaluateTargetParent(actor, item, target)
}

export function evaluatePermanentDelete<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
): ResourceOperationCapability {
  if (!isTrashedSidebarItem(item)) {
    return reject('not_trashed', 'This item is no longer in the trash')
  }

  if (!actor.canManageFolders) {
    if (item.type === RESOURCE_TYPES.folders) {
      return reject('dm_only', 'Only the DM can permanently delete folders')
    }
  }

  if (
    !hasPermissionForOperation(
      item.myPermissionLevel,
      PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER,
    )
  ) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return ok()
}

export function evaluateCopy<TId extends string>(
  actor: OperationActorSnapshot,
  item: OperationResourceItem<TId>,
  target: OperationTargetSnapshot<TId>,
): ResourceOperationCapability {
  if (!isActiveResourceItem(item)) {
    return reject('trashed_item', 'Only active resources can be copied')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.COPY_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return evaluateTargetParent(actor, item, target)
}
