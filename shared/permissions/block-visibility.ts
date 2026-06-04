import { SHARE_STATUS } from '../editor-blocks/share-status'
import { hasPermissionForRequirement } from './requirements'
import { PERMISSION_LEVEL } from './types'
import type { ShareStatus } from '../editor-blocks/share-status'
import type { PermissionLevel } from './types'

type BlockVisibilityPermissionInput = {
  isDm: boolean
  notePermissionLevel: PermissionLevel | null | undefined
  allPlayersPermissionLevel: typeof PERMISSION_LEVEL.NONE | typeof PERMISSION_LEVEL.VIEW
  memberPermissionLevel?: PermissionLevel | null
}

export function getBlockAllPlayersPermissionLevel(
  shareStatus: ShareStatus | null | undefined,
): typeof PERMISSION_LEVEL.NONE | typeof PERMISSION_LEVEL.VIEW {
  const normalizedShareStatus = shareStatus ?? SHARE_STATUS.NOT_SHARED
  switch (normalizedShareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_LEVEL.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED:
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_LEVEL.NONE
    default:
      return assertUnhandledShareStatus(normalizedShareStatus)
  }
}

export function getEffectiveBlockVisibilityPermissionLevel({
  isDm,
  notePermissionLevel,
  allPlayersPermissionLevel,
  memberPermissionLevel,
}: BlockVisibilityPermissionInput): PermissionLevel {
  if (isDm) return PERMISSION_LEVEL.EDIT
  if (!hasPermissionForRequirement(notePermissionLevel, PERMISSION_LEVEL.VIEW)) {
    return PERMISSION_LEVEL.NONE
  }
  if (hasPermissionForRequirement(notePermissionLevel, PERMISSION_LEVEL.EDIT)) {
    return PERMISSION_LEVEL.VIEW
  }
  if (memberPermissionLevel === PERMISSION_LEVEL.NONE) return PERMISSION_LEVEL.NONE
  if (isViewGrantingPermission(memberPermissionLevel)) return PERMISSION_LEVEL.VIEW
  return allPlayersPermissionLevel
}

function isViewGrantingPermission(permissionLevel: PermissionLevel | null | undefined): boolean {
  switch (permissionLevel) {
    case PERMISSION_LEVEL.VIEW:
    case PERMISSION_LEVEL.EDIT:
    case PERMISSION_LEVEL.FULL_ACCESS:
      return true
    case PERMISSION_LEVEL.NONE:
    case null:
    case undefined:
      return false
  }
}

function assertUnhandledShareStatus(shareStatus: never): never {
  throw new Error(`Unhandled SHARE_STATUS: ${String(shareStatus)}`)
}
