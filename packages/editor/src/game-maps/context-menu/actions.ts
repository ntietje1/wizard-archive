import { toast } from 'sonner'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import { getClientErrorMessage } from '../../../../../shared/errors/client'
import type { WorkspaceMapPinMenuService } from './service'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import type { ResourceOperationResult } from '../../filesystem/transaction-contract'
import { isCompletedResourceOperation } from '../viewer/map-action-errors'

export interface WorkspaceMapPinContextMenuActions {
  pinToMap: (context: WorkspaceMenuContext) => void | Promise<void>
  goToMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  createMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  removeMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  moveMapPin: (context: WorkspaceMenuContext) => void | Promise<void>
  togglePinVisibility: (context: WorkspaceMenuContext) => void | Promise<void>
}

function reportMapPinActionError(error: unknown, fallbackMessage: string) {
  const resolvedError = resolveMapPinActionError(error)
  const message = getClientErrorMessage(resolvedError)
  toast.error(message && message.trim().length > 0 ? message : fallbackMessage)
  console.error(resolvedError)
}

export function createMapPinActions({
  mapPins,
  openItem,
}: {
  mapPins: WorkspaceMapPinMenuService
  openItem: (itemId: SidebarItemId, options?: { replace?: boolean }) => void | Promise<void>
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

    goToMapPin: async (ctx: WorkspaceMenuContext) => {
      const activeMap = mapPins.getActiveMap()
      if (!ctx.item || !activeMap) return

      if (!activeMap.pinnedItemIds.has(ctx.item.id)) {
        toast.error('Item is not pinned on this map')
        return
      }

      try {
        await openItem(activeMap.id)
        toast.info('Highlighting map pin... (coming soon)')
      } catch (error) {
        reportMapPinActionError(error, 'Failed to navigate to map pin')
      }
    },

    createMapPin: (ctx: WorkspaceMenuContext) => {
      if (!mapPins.canEditActiveMap()) return
      if (!ctx.item || !mapPins.getActiveMap()) return

      toast.info('Create Pin Here... (coming soon)')
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
          reportMapPinActionError(result, 'Failed to remove pin')
          return
        }
        toast.success('Pin removed')
      } catch (error) {
        reportMapPinActionError(error, 'Failed to remove pin')
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
          reportMapPinActionError(result, 'Failed to toggle pin visibility')
          return
        }
        toast.success(newVisible ? 'Pin shown' : 'Pin hidden')
      } catch (error) {
        reportMapPinActionError(error, 'Failed to toggle pin visibility')
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

function resolveMapPinActionError(error: unknown) {
  if (isMapPinOperationFailure(error)) {
    return error.status === 'error' ? error.error : new Error(error.reason)
  }
  return error
}

function isMapPinOperationFailure(
  error: unknown,
): error is Exclude<ResourceOperationResult, { status: 'completed' }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error.status === 'error' || error.status === 'unsupported' || error.status === 'unavailable')
  )
}
