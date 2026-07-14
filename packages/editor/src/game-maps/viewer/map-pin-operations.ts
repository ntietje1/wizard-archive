import type { ResourceId, MapPinId } from '../../resources/domain-id'
import type { MaybePromise } from '../../../../../shared/common/async'

import type { ResourceOperationResult } from '../../filesystem/transaction-contract'

export interface MapPinOperations {
  removeMapPin: (input: {
    mapId: ResourceId
    mapPinId: MapPinId
  }) => MaybePromise<ResourceOperationResult>
  updateMapPinVisibility: (input: {
    isVisible: boolean
    mapId: ResourceId
    mapPinId: MapPinId
  }) => MaybePromise<ResourceOperationResult>
}

export interface MapPinInteractionRequests {
  requestPinPlacement: (input: { itemIds: Array<ResourceId> }) => void
  requestPinMove: (input: { pinId: MapPinId }) => void
}
