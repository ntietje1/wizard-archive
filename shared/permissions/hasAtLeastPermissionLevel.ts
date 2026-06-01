import { PERMISSION_RANK } from './types'
import type { PermissionLevel } from './types'

export function hasAtLeastPermissionLevel(
  level: PermissionLevel,
  requiredLevel: PermissionLevel,
): boolean {
  return PERMISSION_RANK[level] >= PERMISSION_RANK[requiredLevel]
}
