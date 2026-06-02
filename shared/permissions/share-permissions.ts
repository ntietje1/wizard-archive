import { PERMISSION_LEVEL } from './types'
import type { PermissionLevel } from './types'

export function normalizeExplicitSharePermissionLevel(
  permissionLevel: PermissionLevel | null | undefined,
): PermissionLevel {
  return permissionLevel ?? PERMISSION_LEVEL.VIEW
}
