import { PERMISSION_LEVEL, PERMISSION_RANK } from './types'
import type { PermissionLevel } from './types'

export const PERMISSION_OPERATION = {
  READ_SIDEBAR_ITEM: 'read_sidebar_item',
  MANAGE_SIDEBAR_ITEM: 'manage_sidebar_item',
  MOVE_SIDEBAR_ITEM: 'move_sidebar_item',
  COPY_SIDEBAR_ITEM: 'copy_sidebar_item',
  TRASH_SIDEBAR_ITEM: 'trash_sidebar_item',
  RESTORE_SIDEBAR_ITEM: 'restore_sidebar_item',
  DELETE_SIDEBAR_ITEM_FOREVER: 'delete_sidebar_item_forever',
} as const

type PermissionOperation = (typeof PERMISSION_OPERATION)[keyof typeof PERMISSION_OPERATION]

const PERMISSION_OPERATION_REQUIREMENT = {
  [PERMISSION_OPERATION.READ_SIDEBAR_ITEM]: PERMISSION_LEVEL.VIEW,
  [PERMISSION_OPERATION.MANAGE_SIDEBAR_ITEM]: PERMISSION_LEVEL.FULL_ACCESS,
  [PERMISSION_OPERATION.MOVE_SIDEBAR_ITEM]: PERMISSION_LEVEL.FULL_ACCESS,
  [PERMISSION_OPERATION.COPY_SIDEBAR_ITEM]: PERMISSION_LEVEL.FULL_ACCESS,
  [PERMISSION_OPERATION.TRASH_SIDEBAR_ITEM]: PERMISSION_LEVEL.FULL_ACCESS,
  [PERMISSION_OPERATION.RESTORE_SIDEBAR_ITEM]: PERMISSION_LEVEL.FULL_ACCESS,
  [PERMISSION_OPERATION.DELETE_SIDEBAR_ITEM_FOREVER]: PERMISSION_LEVEL.FULL_ACCESS,
} satisfies Record<PermissionOperation, PermissionLevel>

export function hasPermissionForRequirement(
  level: PermissionLevel | null | undefined,
  requiredLevel: PermissionLevel,
): boolean {
  return PERMISSION_RANK[level ?? PERMISSION_LEVEL.NONE] >= PERMISSION_RANK[requiredLevel]
}

export function hasPermissionForOperation(
  level: PermissionLevel | null | undefined,
  operation: PermissionOperation,
): boolean {
  return hasPermissionForRequirement(level, PERMISSION_OPERATION_REQUIREMENT[operation])
}
