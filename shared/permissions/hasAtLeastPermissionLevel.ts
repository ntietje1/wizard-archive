import { hasPermissionForRequirement } from './requirements'
import type { PermissionLevel } from './types'

export function hasAtLeastPermissionLevel(
  level: PermissionLevel,
  requiredLevel: PermissionLevel,
): boolean {
  return hasPermissionForRequirement(level, requiredLevel)
}
