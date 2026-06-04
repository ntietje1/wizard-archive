import { PERMISSION_LEVEL } from '../../shared/permissions/types'
import type { PermissionLevel } from '../../shared/permissions/types'

export function getBlockSharePermissionLevelMigrationPatch(share: {
  permissionLevel?: PermissionLevel | null
}): { permissionLevel: typeof PERMISSION_LEVEL.VIEW } | null {
  if (share.permissionLevel != null) return null
  return { permissionLevel: PERMISSION_LEVEL.VIEW }
}
