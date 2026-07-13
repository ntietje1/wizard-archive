import type { MaybePromise } from '../../../../shared/common/async'
import type { MapPinId, SidebarItemId } from '../../../../shared/common/ids'
import type { ResourceImportFile } from '../files/import-contract'
import type { ResourceOperationResult } from '../filesystem/transaction-contract'

interface MapSessionUpdateImageInput {
  file: ResourceImportFile
  layerId?: string | null
  mapId: SidebarItemId
}

interface MapSessionCreatePinsInput {
  mapId: SidebarItemId
  pins: Array<{
    itemId: SidebarItemId
    layerId?: string | null
    x: number
    y: number
  }>
}

interface MapSessionUpdatePinInput {
  mapId: SidebarItemId
  mapPinId: MapPinId
  x: number
  y: number
}

interface MapSessionSetPinVisibilityInput {
  mapId: SidebarItemId
  mapPinId: MapPinId
  isVisible: boolean
}

interface MapSessionRemovePinInput {
  mapId: SidebarItemId
  mapPinId: MapPinId
}

type MapPinsCreatedReceipt = {
  kind: 'mapPinsCreated'
  affectedCount: number
  itemId: SidebarItemId
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
