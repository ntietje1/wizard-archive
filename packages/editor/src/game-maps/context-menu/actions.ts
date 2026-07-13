import { toast } from 'sonner'
import type { WorkspaceMapPinMenuService } from './service'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import { isCompletedResourceOperation, reportMapActionError } from '../viewer/map-action-errors'

export interface WorkspaceMapPinContextMenuActions {
  pinToMap: (context: WorkspaceMenuContext) => void | Promise<void>
  removeMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  moveMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  togglePinVisibility: (context: WorkspaceMenuContext) => void | Promise<void>
}

export function createMapPinActions({
  mapPins,
}: {
  mapPins: WorkspaceMapPinMenuService
}): WorkspaceMapPinContextMenuActions {
  return {
    pinToMap: (ctx: WorkspaceMenuContext) => {
      if (!mapPins.canEditActiveMap()) return

      const itemIds = mapPins.getUnpinnedMapItems(ctx).map((item) => item.id)
      if (itemIds.length === 0) {
        toast.error('Selected items are already pinned on this map')
        return
      }

      mapPins.requestPinPlacement({ itemIds })
    },

    removeMapPin: async () => {
      if (!mapPins.canEditActiveMap()) return

      const activeMap = mapPins.getActiveMap()
      const activePin = mapPins.getActivePin()
      if (!activePin) return

      try {
        const mapPinOperations = mapPins.getPinOperations()
        const result = await mapPinOperations.removeMapPin({
          mapId: activeMap.id,
          mapPinId: activePin.id,
        })
        if (!isCompletedResourceOperation(result)) {
          reportMapActionError(result, 'Failed to remove pin')
          return
        }
        toast.success('Pin removed')
      } catch (error) {
        reportMapActionError(error, 'Failed to remove pin')
      }
    },

    togglePinVisibility: async () => {
      if (!mapPins.canEditActiveMap()) return

      const activeMap = mapPins.getActiveMap()
      const activePin = mapPins.getActivePin()
      if (!activePin) return

      const newVisible = activePin.visible !== true
      try {
        const mapPinOperations = mapPins.getPinOperations()
        const result = await mapPinOperations.updateMapPinVisibility({
          isVisible: newVisible,
          mapId: activeMap.id,
          mapPinId: activePin.id,
        })
        if (!isCompletedResourceOperation(result)) {
          reportMapActionError(result, 'Failed to toggle pin visibility')
          return
        }
        toast.success(newVisible ? 'Pin shown' : 'Pin hidden')
      } catch (error) {
        reportMapActionError(error, 'Failed to toggle pin visibility')
      }
    },

    moveMapPin: () => {
      if (!mapPins.canEditActiveMap()) return

      const activePin = mapPins.getActivePin()
      if (!activePin) return

      mapPins.requestPinMove({ pinId: activePin.id })
    },
  }
}
