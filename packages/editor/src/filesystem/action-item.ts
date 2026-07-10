import { PERMISSION_LEVEL } from '../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../shared/permissions/types'
import type { AnyItem } from '../workspace/items'
import type { FileSystemPermissions } from './permissions'

type RuntimePermissions = Pick<FileSystemPermissions, 'canAccessItem' | 'canMutateItem'>

export function projectFileSystemActionItem<TItem extends AnyItem>(
  item: TItem,
  permissions: RuntimePermissions,
): TItem {
  return {
    ...item,
    myPermissionLevel: getActionPermissionLevel(item, permissions),
  }
}

function getActionPermissionLevel(item: AnyItem, permissions: RuntimePermissions): PermissionLevel {
  if (!permissions.canAccessItem(item, PERMISSION_LEVEL.VIEW)) return PERMISSION_LEVEL.NONE
  if (!permissions.canMutateItem(item, PERMISSION_LEVEL.EDIT)) return PERMISSION_LEVEL.VIEW
  if (!permissions.canMutateItem(item, PERMISSION_LEVEL.FULL_ACCESS)) return PERMISSION_LEVEL.EDIT
  return PERMISSION_LEVEL.FULL_ACCESS
}
