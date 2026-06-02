import { SHARE_STATUS } from '../editor-blocks/share-status'
import { PERMISSION_LEVEL } from './types'
import type { ShareStatus } from '../editor-blocks/share-status'
import type { PermissionLevel } from './types'

type BlockVisibilityPermissionInput = {
  isDm: boolean
  shareStatus: ShareStatus | null | undefined
  isIndividuallySharedWithMember?: boolean
}

export function getBlockVisibilityPermissionLevel({
  isDm,
  shareStatus,
  isIndividuallySharedWithMember = false,
}: BlockVisibilityPermissionInput): PermissionLevel {
  if (isDm) return PERMISSION_LEVEL.EDIT

  const normalizedShareStatus = shareStatus ?? SHARE_STATUS.NOT_SHARED
  switch (normalizedShareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_LEVEL.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED:
      return isIndividuallySharedWithMember ? PERMISSION_LEVEL.VIEW : PERMISSION_LEVEL.NONE
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_LEVEL.NONE
    default:
      return assertUnhandledShareStatus(normalizedShareStatus)
  }
}

function assertUnhandledShareStatus(shareStatus: never): never {
  throw new Error(`Unhandled SHARE_STATUS: ${String(shareStatus)}`)
}
