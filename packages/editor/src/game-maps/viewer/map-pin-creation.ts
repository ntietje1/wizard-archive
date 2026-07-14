import type { ResourceId } from '../../resources/domain-id'
import type { MaybePromise } from '../../../../../shared/common/async'

import type { MapPinsCreateResult } from '../session-contract'
import { reportMapActionError } from './map-action-errors'
import { reportMapPinCreationResult } from './map-pin-creation-feedback'
import { buildMapPinPlacementInputs } from './map-pin-placement'
import type { MapPinPlacementInput, PinPosition } from './map-pin-placement'

type CreateMapPins = (input: {
  mapId: ResourceId
  pins: Array<MapPinPlacementInput>
}) => MaybePromise<MapPinsCreateResult>

export async function createMapPinsAtPosition({
  createMapPins,
  layerId,
  itemIds,
  mapId,
  position,
}: {
  createMapPins: CreateMapPins
  layerId?: string | null
  itemIds: Array<ResourceId>
  mapId: ResourceId
  position: PinPosition
}) {
  let result: MapPinsCreateResult
  try {
    result = await createMapPins({
      mapId,
      pins: buildMapPinPlacementInputs(itemIds, position).map((pin) => ({
        ...pin,
        layerId: layerId ?? null,
      })),
    })
  } catch (error) {
    reportMapActionError(
      error,
      itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins',
    )
    return false
  }

  if (result.status !== 'completed') {
    reportMapActionError(
      result,
      itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins',
    )
    return false
  }

  try {
    return reportMapPinCreationResult(result.receipt.pinIds, itemIds.length)
  } catch (error) {
    reportMapActionError(
      error,
      itemIds.length === 1 ? 'Failed to place pin' : 'Failed to place pins',
    )
    return false
  }
}
