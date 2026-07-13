import type { MaybePromise } from '../../../../../shared/common/async'
import type { SidebarItemId } from '../../../../../shared/common/ids'
import type { MapPinId } from '../../resources/domain-id'
import type { ResourceOperationResult } from '../../filesystem/transaction-contract'

export interface MapPinOperations {
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

export interface MapPinInteractionRequests {
  requestPinPlacement: (input: { itemIds: Array<SidebarItemId> }) => void
  requestPinMove: (input: { pinId: MapPinId }) => void
}
