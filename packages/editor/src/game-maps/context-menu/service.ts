import type { AnyItem } from '../../workspace/items'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapPinId } from '../../resources/domain-id'
import type { MaybePromise } from '../../../../../shared/common/async'
import type { WorkspaceMenuContext } from '../../workspace/menu-context'
import type { MapPinInteractionRequests } from '../viewer/map-pin-operations'
import type { ResourceOperationResult } from '../../filesystem/transaction-contract'

interface WorkspaceMapPinActiveMapState {
  id: SidebarItemId
  pinnedItemIds: ReadonlySet<SidebarItemId>
}

interface WorkspaceMapPinActivePinState {
  id: MapPinId
  item: AnyItem | null
  visible: boolean | undefined
}

interface WorkspaceMapPinOperations {
  removeMapPin: (input: {
    mapId: SidebarItemId
    mapPinId: MapPinId
  }) => MaybePromise<ResourceOperationResult>
  updateMapPinVisibility: (input: {
    isVisible: boolean
    mapId: SidebarItemId
    mapPinId: MapPinId
  }) => MaybePromise<ResourceOperationResult>
}

export interface MapPinMenuServiceState {
  activeMap: WorkspaceMapPinActiveMapState
  canEditActiveMap: boolean
  activePin: WorkspaceMapPinActivePinState | null
  pinOperations: WorkspaceMapPinOperations
  pinRequests: MapPinInteractionRequests
}

export interface WorkspaceMapPinMenuService {
  getActiveMap: () => WorkspaceMapPinActiveMapState
  getActivePin: () => WorkspaceMapPinActivePinState | null
  canEditActiveMap: () => boolean
  getPinOperations: () => WorkspaceMapPinOperations
  requestPinPlacement: MapPinInteractionRequests['requestPinPlacement']
  requestPinMove: MapPinInteractionRequests['requestPinMove']
  getUnpinnedMapItems: (context: WorkspaceMenuContext) => Array<AnyItem>
  isActiveMapItem: (item: AnyItem | undefined) => boolean
  isPinnedOnActiveMap: (item: AnyItem | undefined) => boolean
  hasPinContext: () => boolean
  getActivePinVisible: () => boolean | undefined
}

export function createMapPinMenuService(state: MapPinMenuServiceState): WorkspaceMapPinMenuService {
  const activeMapState = state.activeMap
  const activePinState = state.activePin
  const canEditActiveMap = state.canEditActiveMap
  const pinOperations = state.pinOperations
  const pinRequests = state.pinRequests

  return {
    getActiveMap: () => activeMapState,
    getActivePin: () => activePinState,
    canEditActiveMap: () => canEditActiveMap,
    getPinOperations: () => pinOperations,
    requestPinPlacement: pinRequests.requestPinPlacement,
    requestPinMove: pinRequests.requestPinMove,
    getUnpinnedMapItems: (context) => {
      return context.selectedItems.filter(
        (item) => item.id !== activeMapState.id && !activeMapState.pinnedItemIds.has(item.id),
      )
    },
    isActiveMapItem: (item) => item?.id === activeMapState.id,
    isPinnedOnActiveMap: (item) => item != null && activeMapState.pinnedItemIds.has(item.id),
    hasPinContext: () => activePinState != null,
    getActivePinVisible: () => activePinState?.visible,
  }
}
