import type { ResourceId, MapPinId } from '../resources/domain-id'
import type { MaybePromise } from '../../../../shared/common/async'

import type { ResourceImportFile } from '../files/import-contract'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'

interface MapSessionUpdateImageInput {
  file: ResourceImportFile
  layerId?: string | null
  mapId: ResourceId
}

interface MapSessionCreatePinsInput {
  mapId: ResourceId
  pins: Array<{
    itemId: ResourceId
    layerId?: string | null
    x: number
    y: number
  }>
}

interface MapSessionUpdatePinInput {
  mapId: ResourceId
  mapPinId: MapPinId
  x: number
  y: number
}

interface MapSessionSetPinVisibilityInput {
  mapId: ResourceId
  mapPinId: MapPinId
  isVisible: boolean
}

interface MapSessionRemovePinInput {
  mapId: ResourceId
  mapPinId: MapPinId
}

type MapPinsCreatedReceipt = {
  kind: 'mapPinsCreated'
  affectedCount: number
  itemId: ResourceId
  pinIds: Array<MapPinId>
}

export type MapPinsCreateResult =
  | { status: 'completed'; receipt: MapPinsCreatedReceipt }
  | Exclude<ResourceOperationResult, { status: 'completed' }>

interface MapPinSession {
  create: (input: MapSessionCreatePinsInput) => MaybePromise<MapPinsCreateResult>
  update: (input: MapSessionUpdatePinInput) => MaybePromise<ResourceOperationResult>
  setVisibility: (input: MapSessionSetPinVisibilityInput) => MaybePromise<ResourceOperationResult>
  remove: (input: MapSessionRemovePinInput) => MaybePromise<ResourceOperationResult>
}

export interface MapSession {
  pins: MapPinSession
  updateMapImage: (input: MapSessionUpdateImageInput) => MaybePromise<ResourceOperationResult>
}
