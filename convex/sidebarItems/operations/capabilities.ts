import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { CampaignMemberRole } from '../../campaigns/types'
import type { PermissionLevel } from '../../permissions/types'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

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
  | 'different_location'
  | 'invalid_target'

export type SidebarOperationCapability =
  | { ok: true }
  | { ok: false; code: SidebarOperationRejectionCode; message: string }

export type OperationActorSnapshot = {
  role: CampaignMemberRole
}

export type OperationSidebarItem = Pick<
  AnySidebarItem,
  '_id' | 'type' | 'location' | 'parentId'
> & {
  myPermissionLevel?: PermissionLevel | null
}

export type OperationTargetSnapshot = {
  parentId: Id<'sidebarItems'> | null
  parent: OperationSidebarItem | null
  ancestorIds?: Array<Id<'sidebarItems'>>
}

function ok(): SidebarOperationCapability {
  return { ok: true }
}

function reject(code: SidebarOperationRejectionCode, message: string): SidebarOperationCapability {
  return { ok: false, code, message }
}

function hasFullAccess(level: PermissionLevel | null | undefined): boolean {
  return hasAtLeastPermissionLevel(level ?? PERMISSION_LEVEL.NONE, PERMISSION_LEVEL.FULL_ACCESS)
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

  if (target.parent.location === SIDEBAR_ITEM_LOCATION.trash) {
    return reject('trashed_folder', 'Trashed folders are uneditable')
  }

  if (!hasFullAccess(target.parent.myPermissionLevel)) {
    return reject('no_target_permission', 'You do not have sufficient permission for this folder')
  }

  return ok()
}

function evaluateTargetParent(
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
  targetLocation: OperationSidebarItem['location'],
): SidebarOperationCapability {
  const parentAccess = evaluateParentAccess(target)
  if (!parentAccess.ok) return parentAccess
  if (target.parentId === null) return ok()

  if (target.parent?.location !== targetLocation) {
    return reject('different_location', 'Cannot move items into a folder in a different location')
  }

  if (
    item.type === SIDEBAR_ITEM_TYPES.folders &&
    (target.parentId === item._id || target.ancestorIds?.includes(item._id))
  ) {
    return reject('circular', 'This move would create a circular reference')
  }

  return ok()
}

export function evaluateMoveToParent(
  _actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (!hasFullAccess(item.myPermissionLevel)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return evaluateTargetParent(item, target, item.location)
}

export function evaluateTrash(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
): SidebarOperationCapability {
  if (item.location === SIDEBAR_ITEM_LOCATION.trash) {
    return reject('already_trashed', 'This item is already in the trash')
  }

  if (!hasFullAccess(item.myPermissionLevel)) {
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
  if (item.location !== SIDEBAR_ITEM_LOCATION.trash) {
    return reject('not_trashed', 'Only trashed items can be restored')
  }

  if (!hasFullAccess(item.myPermissionLevel)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  if (item.type === SIDEBAR_ITEM_TYPES.folders && actor.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    return reject('dm_only', 'Only the DM can restore folders')
  }

  return evaluateTargetParent(item, target, SIDEBAR_ITEM_LOCATION.sidebar)
}

export function evaluatePermanentDelete(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
): SidebarOperationCapability {
  if (item.location !== SIDEBAR_ITEM_LOCATION.trash) {
    return reject('not_trashed', 'This item is no longer in the trash')
  }

  if (actor.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    if (item.type === SIDEBAR_ITEM_TYPES.folders) {
      return reject('dm_only', 'Only the DM can permanently delete folders')
    }
    if (!hasFullAccess(item.myPermissionLevel)) {
      return reject('no_source_permission', 'You do not have sufficient permission for this item')
    }
  }

  return ok()
}

export function evaluateDuplicate(
  actor: OperationActorSnapshot,
  item: OperationSidebarItem,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (item.location !== SIDEBAR_ITEM_LOCATION.sidebar) {
    return reject('trashed_item', 'Only active sidebar items can be duplicated')
  }

  if (!hasFullAccess(item.myPermissionLevel)) {
    return reject('no_source_permission', 'You do not have sufficient permission for this item')
  }

  return evaluatePasteTarget(actor, target)
}

export function evaluatePasteTarget(
  actor: OperationActorSnapshot,
  target: OperationTargetSnapshot,
): SidebarOperationCapability {
  if (target.parentId === null) {
    return actor.role === CAMPAIGN_MEMBER_ROLE.DM
      ? ok()
      : reject('dm_only', 'Only the DM can create items at the root level')
  }

  return evaluateParentAccess(target)
}
