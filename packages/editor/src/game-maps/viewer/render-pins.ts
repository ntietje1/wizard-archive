import type { MapItemWithContent, MapPinWithItem } from '../../game-maps/item-contract'
import { PERMISSION_LEVEL } from '../../../../../shared/permissions/types'
import type { PermissionLevel } from '../../../../../shared/permissions/types'
import type { AnyItem } from '../../workspace/items'

type WorkspaceMapRenderPinPermissions = {
  canAccessItem: (item: AnyItem, level: PermissionLevel) => boolean
}

export function createWorkspaceMapRenderPins(permissions: WorkspaceMapRenderPinPermissions) {
  return (map: MapItemWithContent) => resolveWorkspaceMapRenderPins(map, permissions)
}

function resolveWorkspaceMapRenderPins(
  map: MapItemWithContent,
  permissions: WorkspaceMapRenderPinPermissions,
) {
  const canEditMap = permissions.canAccessItem(map, PERMISSION_LEVEL.EDIT)
  const pins = canEditMap ? map.pins : map.pins.filter((pin) => pin.visible === true)

  const isPinGhost = (pin: MapPinWithItem): boolean => {
    if (!pin.item) return true
    return !permissions.canAccessItem(pin.item, PERMISSION_LEVEL.VIEW)
  }

  return { status: 'available' as const, pins, isPinGhost }
}
