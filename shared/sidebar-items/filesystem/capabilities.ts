import type { SidebarItemId } from '../../common/ids'
import type { FileSystemSidebarItem } from './types'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_OPERATION, hasPermissionForOperation } from '../../permissions/requirements'
import { SIDEBAR_ITEM_TYPES, isActiveSidebarItem, isTrashedSidebarItem } from '../types'
import type { CampaignMemberRole } from '../../campaigns/types'
import type { PermissionLevel } from '../../permissions/types'

export type SidebarOperationRejectionCode =
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

export type SidebarOperationCapability =
  | { ok: true }
  | { ok: false; code: SidebarOperationRejectionCode; message: string }

export type OperationActorSnapshot = {
  role: CampaignMemberRole
}

export type OperationSidebarItem = Pick<
  FileSystemSidebarItem,
  '_id' | 'type' | 'status' | 'parentId'
> & { myPermissionLevel?: PermissionLevel | null }

export type OperationTargetSnapshot = {
  parentId: SidebarItemId | null
  parent: OperationSidebarItem | null
  ancestorIds?: Array<SidebarItemId>
}

function ok(): SidebarOperationCapability {
  return { ok: true }
}

function reject(code: SidebarOperationRejectionCode, message: string): SidebarOperationCapability {
  return { ok: false, code, message }
}

export function isPermissionRejectionCode(code: SidebarOperationRejectionCode): boolean {
  return code === 'no_source_permission' || code === 'no_target_permission' || code === 'dm_only'
}

function evaluateParentAccess(target: OperationTargetSnapshot): SidebarOperationCapability {
  if (target.parentId === null) return ok()

  if (!target.parent) {
    return reject('not_found', 'Parent not found')
  }

  if (target.parent.type !== SIDEBAR_ITEM_TYPES.folders) {
    return reject('not_folder', 'Parent must be a folder')
  }

  if (isTrashedSidebarItem(target.parent)) {
    return reject('trashed_folder', 'Trashed folders are uneditable')
  }

  if (!isActiveSidebarItem(target.parent)) {
    return reject('invalid_target', 'Parent not found')
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

function evaluateRootCreationAccess(actor: OperationActorSnapshot): SidebarOperationCapability {
  return actor.role === CAMPAIGN_MEMBER_ROLE.DM
    ? ok()
    : reject('dm_only', 'Only the DM can create items at the root level')
}

function evaluateTargetParent(
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  const parentAccess = evaluateParentAccess(target)
  if (!parentAccess.ok) return parentAccess
  if (target.parentId === null) return ok()

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    if (!target.ancestorIds) {
      return reject('missing_ancestor_ids', 'Folder target ancestry is required')
    }
    if (target.parentId === item._id || target.ancestorIds.includes(item._id)) {
      return reject('circular', 'This move would create a circular reference')
    }
  }

  return ok()
}

export function evaluateMoveToParent(
  _actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (!isActiveSidebarItem(item)) {
    return reject('trashed_item', 'Only active items can be moved')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return evaluateTargetParent(item, target)
}

export function evaluateTrash(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
): SidebarOperationCapability {
  if (!isActiveSidebarItem(item) && !isTrashedSidebarItem(item)) {
    return reject('invalid_target', 'Only active items can be moved to trash')
  }

  if (isTrashedSidebarItem(item)) {
    return reject('already_trashed', 'This item is already in the trash')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.TRASH_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (item.type === SIDEBAR_ITEM_TYPES.folders && actor.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return reject('dm_only', 'Only the DM can trash folders')
  }

  return ok()
}

export function evaluateRestore(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (!isTrashedSidebarItem(item)) {
    return reject('not_trashed', 'Only trashed items can be restored')
  }

  if (
    !hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.RESTORE_SIDEBAR_ITEM)
  ) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (item.type === SIDEBAR_ITEM_TYPES.folders && actor.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return reject('dm_only', 'Only the DM can restore folders')
  }

  return evaluateTargetParent(item, target)
}

export function evaluatePermanentDelete(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
): SidebarOperationCapability {
  if (!isTrashedSidebarItem(item)) {
    return reject('not_trashed', 'This item is no longer in the trash')
  }

  if (actor.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      return reject('dm_only', 'Only the DM can permanently delete folders')
    }
  }

  if (
    actor.role !== CAMPAIGN_MEMBER_ROLE.DM &&
    !hasPermissionForOperation(
      item.myPermissionLevel,
      PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER,
    )
  ) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return ok()
}

export function evaluateCopy(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (!isActiveSidebarItem(item)) {
    return reject('trashed_item', 'Only active sidebar items can be copied')
  }

  if (!hasPermissionForOperation(item.myPermissionLevel, PERMISSION_OPERATION.COPY_SIDEBAR_ITEM)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (target.parentId === null) return evaluateRootCreationAccess(actor)
  return evaluateTargetParent(item, target)
}
