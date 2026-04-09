export const PERMISSION_LEVEL = {
  NONE: 'none',
  VIEW: 'view',
  EDIT: 'edit',
  FULL_ACCESS: 'full_access',
} as const

export type PermissionLevel = (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL]

export const PERMISSION_RANK: Record<PermissionLevel, number> = {
  [PERMISSION_LEVEL.NONE]: 0,
  [PERMISSION_LEVEL.VIEW]: 1,
  [PERMISSION_LEVEL.EDIT]: 2,
  [PERMISSION_LEVEL.FULL_ACCESS]: 3,
}
